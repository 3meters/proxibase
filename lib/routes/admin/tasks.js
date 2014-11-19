/**
 *  /routes/admin/tasks
 *
 *    store and execute recurring tasks using the state manager
 *    Any worker in the cluster can recevie requests insert update
 *    delete start or stop the tasks.  However, only the taskMaster
 *    worker will acually respond to the start and stop commands.
 *    All other workers send a broadcast message to the cluster to
 *    start or stop a task
 */

var path = require('path')
var cluster = require('cluster')
var later = require('later')  // https://github.com/bunkat/later
var state = require('../../state')
var dbOps = {asAdmin: true}
var reAllTasks = /^task/


function addRoutes(app) {
  app.get('/admin/tasks/', get)
  app.get('/admin/tasks/[id]', get)
  app.get('/admin/tasks/start', start)
  app.get('/admin/tasks/[id]/start', start)
  app.get('/admin/tasks/stop', stop)
  app.get('/admin/tasks/[id]/stop', stop)
  app.post('/admin/tasks/', insert)
  app.post('/admin/tasks/[id]', update)
  app.delete('/admin/tasks/[id]', remove)
  app.all('/admin/tasks?*', finish)
}


var taskSpec = {
  key:  {type: 'string', required: true},
  data: {type: 'object', required: true, value: {
    name: {type: 'string', required: true},
    schedule: {type: 'object', required: true, value: {
      // See http://bunkat.github.io/later/schedules.html
      schedules:  {type: 'array', required: true},
      exceptions: {type: 'array'},
    }},
    enabled:          {type: 'boolean', default: true},
    module:           {type: 'string', required: true},   // relative to prox/lib
    method:           {type: 'string', required: true},   // must be exported
    args:             {type: 'array'},                    // arguments passed to method
  }},
}


// Get a task or all tasks from the state manager
function get(req, res, next) {
  var key = req.param.id || reAllTasks
  state.get(key, function(err, results) {
    if (err) return next(err)
    if (req.param.id && results.length) req.results = results[0]
    else req.results = results
    next()
  })
}


// Broadcast a message to start a task
function start(req, res, next) {
  var taskId = req.param.id
  state.get(taskId, function(err, taskDoc) {
    if (err) return next(err)
    if (!taskDoc) return next(perr.notFound)
    process.send({broadcast: true, startTask: taskId})
    res.send({running: true})
  })
}


// Broadcast a message to stop a task
function stop(req, res, next) {
  var taskId = req.param.id
  state.get(taskId, function(err, taskDoc) {
    if (err) return next(err)
    if (!taskDoc) return next(perr.notFound)
    process.send({broadcast: true, stopTask: taskId})
    res.send({running: false})
  })
}


// Broadcast a message to start all tasks
function startAll(req, res, next) {
  process.send({broadcast: true, startAllTasks: true})
  res.send({running: true})
}


// Broadcast a message to the cluster for the taskMaster to
// stop all tasks
function stopAll(req, res, next) {
  process.send({broadcast: true, stopAllTasks: true})
  res.send({running: false})
}


// Start all tasks in the database
function _startAll(cb) {

  var taskCount = 0

  state.get(reAllTasks, function(err, taskDocs) {
    if (err) return next(err)

    taskDocs.forEach(function(taskDoc) {
      if (!taskDoc.data.enabled) return
      err = _start(taskDoc, {doNotRunOnStart: true})
      if (tipe.error(err)) cb('Error ' + err.message + ' starting task:', taskDoc)
      else taskCount++
    })

    cb(null, {count: taskCount, tasks: taskDocs})
  })
}


// Util.tasks exists only on the taskMaster.  They are the actual handles
// to the running tasks
function _stopAll(cb) {
  var stopped = 0
  // TODO: util.tasks is a map, not an array
  util.tasks.forEach(function(task) {
    task.clear()
    stopped++
  })
  util.tasks = {}
  cb(null, {running: 0, stopped: stopped})
}



// Start a recurring task based on a task document
// Unless options.doNotRunOnStart is true, starting a recurring test
// will run it once immediatly regardless of its schedule.  This is
// to prevent task records being created with tasks that throw syncronous
// errors.
function _start(taskId, options) {

  var err, task, originalArgs

  var taskDoc = util.tasks[taskId]

  err = scrub(taskDoc, taskSpec)
  if (err) return perr.badValue(err)

  var taskData = taskDoc.data

  // Stash the original args in case executing the task changes them
  originalArgs = util.clone(taskData.args)

  // Unless explicity told not to, run the task once to make sure it
  // doesn't throw syncronously before inserting or updating the task record
  if (!(options && options.doNotRunOnStart)) {
    log('Executing task ' + taskDoc.name + ' on start')
    var syncErr = runTask(taskData)
    if (tipe.isError(syncErr)) return syncErr
    taskData.args = originalArgs
  }

  // Try creating a recurring task
  try { task = later.setInterval(function(){ runTask(taskData) }, taskData.schedule) }
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

  return null  // success
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
function insert(req, res, next) {
  var taskDoc = req.body
  var err = scrub(taskDoc, taskSpec)
  if (err) return next(err)
  state.set(taskDoc.key, taskDoc)
  if (tipe.isDefined(taskDoc.enabled) && !taskDoc.enabled) {
    return res.send({running: false})
  }
  else 
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


// Process task messages from the cluster master.
process.on('message', function msgStartTasks(msg) {

  var config = util.config

  // This message should only be received by one worker on
  // cluster startup, and again if the task worker dies and
  // a new task worker is chosen by the master.
  if (msg.becomeTaskMaster) {
    _startAll(function(err, data) {
      if (err) logErr(err)
      else {
        log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks')
        config.isTaskMaster = true
      }
    })
  }

  // No other messages are actionable unless this worker is the taskMaster
  if (!config.isTaskMaster) return

  if (msg.startTask) {
    _start()
  }

  if (msg.startTasks) {
    _startAll(function(err, data) {
      if (err) logErr(err)
      log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks')
    })
  }

  if (msg.stopTasks) {
    _stopAll(function(err, data) {
      if (err) logErr(err)
      log('Worker ' + cluster.worker.id + ' stopped ' + data.count + ' recurring tasks')
      config.tasks.running = false
    })
  }

})



function finish(req, res) {
  if (tipe.isError(req)) {
    return res.error(req)
  }
  res.send(req.results || {})
}

exports.addRoutes = addRoutes
