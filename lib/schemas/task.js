/**
 *  Tasks schema
 */

var mongo = require('../db')
var base = require('./_base')
var path = require('path')
var later = require('later')  // https://github.com/bunkat/later
var sTask = util.statics.schemas.task

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
    start: start,
    clear: clear,
  },
}


// Start a recurring task based on a task document
// Unless options.doNotRunOnStart is true, starting a recurring test
// will run it once immediatly regardless of its schedule.  This is
// to prevent task records being created with tasks that throw syncronous
// errors.
function start(taskDoc, options) {

  var err, module, modulePath, methodChain, fn, thisContext, originalArgs

  // Validate taskDoc against schema
  err = chk(taskDoc, taskSchema.fields)
  if (err) return perr.badValue(err.message||err)

  // Validate the module
  modulePath = path.join(util.statics.appDir, taskDoc.module)

  try {
    modulePath = path.join(util.statics.appDir, taskDoc.module)
  }
  catch (err) {
    return perr.badValue('Invalid module or module path: ' + taskDoc.module)
  }

  module = require(modulePath)
  if (!module) return perr.badValue('Invalid module: ' + taskDoc.module)

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

  // Stash the original args in case executing the task changes them
  originalArgs = taskDoc.args

  // Unless explicity told not to, run the task once to make sure it
  // doesn't throw syncronously before inserting or updating the task record
  if (!(options && options.doNotRunOnStart)) {
    var syncErr = runTask()
    if (tipe.isError(syncErr)) return syncErr
  }

  // Try creating a recurring task
  try { task = later.setInterval(runTask, taskDoc.schedule) }
  catch (err) { return err }

  // Success
  util.tasks[taskDoc._id] = task
  log('Started scheduled task:', taskDoc)
  return null

  // Try running the task
  function runTask() {
    var taskTag = String(Math.floor(Math.random() * 100000))
    log('Executing task ' + taskDoc.name +  ' tag: ' + taskTag + ' at ' + util.nowFormatted())
    taskDoc.args = util.clone(originalArgs)
    // Add our own callback expecting a node-standard signiture
    taskDoc.args.push(function(err, results) {
      if (err) logErr('Error running task ' + taskDoc.name + ' tag: ' + taskTag, err)
      else log('Results from task ' + taskDoc.name + ' tag: ' + taskTag, results)
    })
    try { fn.apply(thisContext, taskDoc.args) }
    catch (e) {
      logTaskErr(e)
      return e
    }
    return null
  }

  // Log task errors to stderr
  function logTaskErr(e) {
    logErr('Task error for ' + taskDoc.name, e.stack||e)
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
  return null
}


// Insert a new task document
function insert(doc, previous, options, cb) {
  if (tipe.isDefined(doc.enabled) && !doc.enabled) return cb()
  cb(start(doc, options))
}


// Update an existing task document
function update(doc, previous, options, cb) {
  clear(doc, options)
  if (tipe.isDefined(doc.enabled) && !doc.enabled) return cb()
  cb(start(doc, options))
}


// Remove a task document
function remove(doc, previous, options, cb) {
  cb(clear(doc, options))
}


exports.getSchema = function() {
  return mongo.createSchema(base, taskSchema)
}
