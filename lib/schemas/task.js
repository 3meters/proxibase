/**
 *  Tasks schema
 */

var mongo = require('../db')
var base = require('./_base')
var path = require('path')
var cluster = require('cluster')
var later = require('later')  // https://github.com/bunkat/later
var sTask = statics.schemas.task

var taskSchema = {

  id: sTask.id,
  name: sTask.name,
  collection: sTask.collection,
  system: true,  // only admins can access

  fields: {
    name:     {type: 'string', required: true},
    schedule: {type: 'object', required: true, value: {
      // See http://bunkat.github.io/later/schedules.html
      schedules:  {type: 'array', required: true},
      exceptions: {type: 'array'}
    }},
    module:   {type: 'string', required: true},   // relative to prox/lib
    method:   {type: 'string', required: true},   // must be exported
    args:     {type: 'array'},                    // arguments passed to method
  },

  validators: {
    insert: [insert],
    update: [update],
    remove: [remove],
  },

  methods: {
    startAll: startAll,
    start: start,
    clear: clear,
  },
}


// Start all tasks in the database
function startAll(cb) {
  var taskCount = 0
  db.tasks.find({enabled: true}).toArray(function(err, taskDocs) {
    if (err) return cb(err)
    taskDocs.forEach(function(taskDoc) {
      err = start(taskDoc, {doNotRunOnStart: true})
      if (tipe.error(err)) cb('Error ' + err + ' starting task:', taskDoc)
      else taskCount++
    })
    cb(null, {count: taskCount, tasks: taskDocs})
  })
}


// Start a recurring task based on a task document
// Unless options.doNotRunOnStart is true, starting a recurring test
// will run it once immediatly regardless of its schedule.  This is
// to prevent task records being created with tasks that throw syncronous
// errors.
function start(taskDoc, options) {

  var err, task, originalArgs

  if (util.config.ignoreTasks) {
    log('not starting task', taskDoc)
    return
  }

  // Validate taskDoc against schema
  err = scrub(taskDoc, taskSchema.fields)
  if (err) return perr.badValue(err)

  // Stash the original args in case executing the task changes them
  originalArgs = util.clone(taskDoc.args)

  // Unless explicity told not to, run the task once to make sure it
  // doesn't throw syncronously before inserting or updating the task record
  if (!(options && options.doNotRunOnStart)) {
    log('Executing task ' + taskDoc.name + ' on start')
    var syncErr = runTask(taskDoc)
    if (tipe.isError(syncErr)) return syncErr
    taskDoc.args = originalArgs
  }

  // Try creating a recurring task
  try { task = later.setInterval(function(){ runTask(taskDoc) }, taskDoc.schedule) }
  catch (err) { return err }

  // Success
  util.tasks[taskDoc._id] = task
  log('Started scheduled task:', taskDoc)
  return null

}

// Try running the task
function runTask(taskDoc) {
  var cmd = makeCmd(taskDoc)
  if (tipe.isError(cmd)) return cmd
  var taskTag = String(Math.floor(Math.random() * 100000))
  // Add our own callback expecting a node-standard signiture
  taskDoc.args.push(function(err, results) {
    if (err) logErr('Error running task ' + taskDoc.name + ' tag: ' + taskTag, err)
    else log('Results from task ' + taskDoc.name + ' tag: ' + taskTag, results)
  })
  log('Executing task ' + taskDoc.name +  ' tag: ' + taskTag + ' at ' + util.nowFormatted())
  try { cmd.fn.apply(cmd.thisContext, taskDoc.args) }
  catch (e) {
    logErr('Task error for ' + taskDoc.name, e.stack||e)
    return e
  }
  return null
}


function makeCmd(taskDoc) {

  var fn, thisContext, modulePath, methodChain

  try { modulePath = path.join(statics.appDir, taskDoc.module) }
  catch (e) { return perr.badValue('Invalid module', taskDoc) }

  var module = require(modulePath)
  if (!module) return perr.badValue('Invalid module', taskDoc)

  // Validate the method
  thisContext = module
  methodChain = taskDoc.method.split('.')
  if (1 === methodChain.length) {
    fn = module[taskDoc.method]
  }
  else {
    // foo.bar.baz.run
    fn = module[methodChain[0]]
    methodChain.shift()
    methodChain.forEach(function(method) {
      thisContext = fn
      fn = fn[method]
    })
  }
  if (!tipe.isFunction(fn)) return perr.badValue('Invalid method: ' + taskDoc.method)

  return {
    fn: fn,
    thisContext: thisContext
  }
}

// Clear a recurring task based on a task document
// Noop if the task was not succesfully started
function clear(doc) {
  if (util.tasks[doc._id]) {
    util.tasks[doc._id].clear()
    delete util.tasks[doc._id]
    log('Task cleared:', doc)
  }
}


// Insert a new task document
function insert(doc, previous, options, cb) {
  if (tipe.isDefined(doc.enabled) && !doc.enabled) return cb()
  cb(start(doc, options))
}


// Update an existing task document
function update(doc, previous, options, cb) {
  if (!previous) return cb(perr.notFound())
  clear(doc)
  if (tipe.isDefined(doc.enabled) && !doc.enabled) return cb()
  cb(start(doc, options))
}


// Remove a task document
function remove(doc, previous, options, cb) {
  cb(clear(doc, options))
}


// Process message from the master to start all tasks
process.on('message', function msgStartTasks(msg) {
  if (!msg.startTasks) return
  startAll(function(err, data) {
    if (err) logErr(err)
    else log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks:', data.tasks)
  })
})


exports.getSchema = function() {
  return mongo.createSchema(base, taskSchema)
}
