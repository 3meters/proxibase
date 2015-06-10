/**
 *  /routes/admin/tasks
 *
 *    store and execute recurring tasks using the state manager
 *    Any worker in the cluster can recevie requests to insert, update,
 *    delete, start, or stop, the tasks.  However, only the taskMaster
 *    worker will acually respond to the start and stop commands.
 *    All other workers send a process message to the cluster master
 *    who in turn relays to the taskMaster.
 *
 *    In this file functions executed only by the task master are 
 *    prefixed with a _
 */

var path = require('path')
var cluster = require('cluster')
var later = require('later')        // https://github.com/bunkat/later
var async = require('async')
var state = require('../../state')
var reAllTasks = /^task\./          // matches state variables that begin with task.
var wait = 100                      // milliseconds to wait after broadcasting to the state mgr to return


function addRoutes(app) {
  app.get('/admin/tasks/:id?', get)
  app.get('/admin/tasks/start', startAll)
  app.get('/admin/tasks/:id/start', start)
  app.get('/admin/tasks/stop', stopAll)
  app.get('/admin/tasks/:id/stop', stop)
  app.post('/admin/tasks/', insert)
  app.post('/admin/tasks/:id', update)
  app.delete('/admin/tasks/:id', remove)
  app.all('/admin/tasks?*', finish)
}


var taskSpec = {
  key:  {type: 'string', required: true, validate: function(v) {
    if (v.indexOf('task.') !== 0) return 'task keys must begin with "task."'
  }},
  name: {type: 'string', required: true},
  schedule: {type: 'object', required: true, value: {
    // See http://bunkat.github.io/later/schedules.html
    schedules:  {type: 'array', required: true},
    exceptions: {type: 'array'},
  }},
  module:           {type: 'string', required: true},   // relative to prox/lib
  method:           {type: 'string', required: true},   // must be exported
  args:             {type: 'array'},                    // arguments passed to method
  enabled:          {type: 'boolean', default: true},
  running:          {type: 'boolean'},
  log:              {type: 'boolean'},
}


// Get a task or all tasks from the state manager
function get(req, res, next) {
  var key = req.params.id || reAllTasks
  state.get(key, function(err, results) {
    if (err) return next(err)
    if (tipe.isArray(results)) req.results = {tasks: results, count: results.length}
    else if (results) req.results = {task: results, count: 1}
    else req.results = {task: null, count: 0}
    next()
  })
}


// Insert a new task document and send a message to start it
function insert(req, res, next) {
  var taskDoc = req.body
  var err = scrub(taskDoc, taskSpec)
  if (err) return next(err)

  state.set(taskDoc.key, taskDoc, function(err, savedDoc) {
    if (err) return next(err)
    process.send({taskMaster: true, startTask: taskDoc.key})
    req.results = {task: savedDoc, count: 1}
    setTimeout(next, wait)
  })
}


// Update an existing task document
function update(req, res, next) {
  var taskId = req.params.id
  state.get(taskId, function(err, taskDoc) {
    if (err) return next(err)
    if (!taskDoc) return next(perr.notFound())
    err = scrub(req.body, taskSpec)
    if (err) return next(err)
    state.set(taskId, req.body, function(err, updatedTask) {
      if (err) return next(err)
      process.send({taskMaster: true, restartTask: taskDoc.key})
      req.results = {task: updatedTask, count: 1}
      setTimeout(next, wait)
    })
  })
}


// Remove a task document
function remove(req, res, next) {
  var taskId = req.params.id
  state.remove(taskId, function(err, count) {
    if (err) return next(err)
    process.send({taskMaster: true, stopTask: taskId})
    req.results = {count: count}
    setTimeout(next, wait)
  })
}


// Send a message to the cluster master, addressed to the task
// master to start a task
function start(req, res, next) {
  var taskId = req.params.id
  state.get(taskId, function(err, taskDoc) {
    if (err) return next(err)
    if (!taskDoc) return next(perr.notFound)
    process.send({taskMaster: true, startTask: taskId})
    setTimeout(function() { res.send({running: true}) }, wait)
  })
}


// Send a message to stop a task
function stop(req, res, next) {
  var taskId = req.params.id
  state.get(taskId, function(err, taskDoc) {
    if (err) return next(err)
    if (!taskDoc) return next(perr.notFound)
    process.send({taskMaster: true, stopTask: taskId})
    setTimeout(function() { res.send({running: false}) }, wait)
  })
}


// Send a message to start all tasks
function startAll(req, res) {
  process.send({taskMaster: true, startAllTasks: true})
  setTimeout(function() { res.send({running: true}) }, wait)
}


// Send a message to stop all tasks
function stopAll(req, res) {
  process.send({taskMaster: true, stopAllTasks: true})
  setTimeout(function() { res.send({running: false}) }, wait)
}


// Package up the results and send the response
function finish(req, res) {
  if (tipe.isError(req)) {
    return res.error(req)
  }
  res.send(req.results)
}


// Run only by task master.
// Start a recurring task already saved in the state manager.
// Unless options.doNotRunOnStart is true, starting a recurring test
// will run it once immediatly regardless of its schedule.  This is
// to prevent task records being created with tasks that throw syncronous
// errors.
function _start(taskId, options, cb) {

  var task, originalArgs

  state.get(taskId, function(err, taskDoc) {
    if (err) return cb(err)
    if (!taskDoc) return cb(perr.notFound())

    // Revalidate in case of stale data
    err = scrub(taskDoc, taskSpec)
    if (err) return cb(perr.badValue(err))

    // If disabled set running to false and update the state
    if (taskDoc.enabled === false) {
      taskDoc.running = false
      return state.set(taskId, taskDoc, cb)
    }

    // Stash the original args in case executing the task changes them
    originalArgs = _.cloneDeep(taskDoc.args)

    // Unless explicity told not to, run the task once to make sure it
    // doesn't throw syncronously before inserting or updating the task record
    if (!(options && options.doNotRunOnStart)) {
      log('Executing task ' + taskDoc.name + ' on start')
      var syncErr = runTask(taskDoc)
      if (tipe.isError(syncErr)) return cb(syncErr)
      taskDoc.args = originalArgs
    }

    // Try creating a recurring task
    try { task = later.setInterval(function(){ runTask(taskDoc) }, taskDoc.schedule) }
    catch (err) { return cb(err) }

    // Success
    util.tasks[taskDoc.key] = task
    taskDoc.running = true
    log('Started scheduled task:', taskDoc)
    state.set(taskId, taskDoc, cb)
  })
}


// Run only by task master.
// Stop a recurring task.  Noop if the task doesn't exist
// or was not started
function _stop(taskId, cb) {

  if (util.tasks[taskId]) {
    util.tasks[taskId].clear()
    delete util.tasks[taskId]
    log('Task stopped:', taskId)
  }
  state.get(taskId, function(err, taskDoc) {
    if (err || !taskDoc) return cb(err, taskDoc)
    taskDoc.running = false
    state.set(taskId, taskDoc, cb)
  })
}

// Start all enabled tasks. Run only by task master
function _startAll(cb) {

  state.get(reAllTasks, function(err, taskDocs) {
    if (err) return cb(err)

    var results = []
    var cStarted = 0

    async.eachSeries(taskDocs, startTaskNoRun, function(err) {
      if (err) return cb(err)
      cb(null, {
        tasks: results,
        count: taskDocs.length,
        started: cStarted,
        stopped: taskDocs.length - cStarted
      })
    })

    // Start all assumes that tasks should not be all run initially,
    // but only when their natural execution time occurs
    function startTaskNoRun(taskDoc, next) {
      if (!taskDoc.enabled) {
        results.push(taskDoc)
        return next()
      }
      _start(taskDoc.key, {doNotRunOnStart: true}, function(err, startedTask) {
        if (err) return next(err)
        cStarted ++
        results.push(startedTask)
        next()
      })
    }
  })
}


// Util.tasks exists only on the taskMaster.  They are the actual handles
// to the running tasks
function _stopAll(cb) {
  var stopped = []

  state.get(reAllTasks, function(err, taskDocs) {

    async.eachSeries(taskDocs, stopTask, finishStopAll)

    function stopTask(taskDoc, next) {
      _stop(taskDoc.key, function(err, stoppedTask) {
        if (err) return next(err)
        stopped.push(stoppedTask)
        next()
      })
    }

    function finishStopAll(err) {
      if (err) return cb(err)
      if (!_.isEmpty(util.tasks)) {
        return cb(perr.serverError('Not all tasks stopped', util.tasks))
      }
      cb(null, {
        tasks: stopped,
        count: stopped.length,
        started: 0,
        stopped: stopped.length,
      })
    }
  })
}




// Try running the task
function runTask(taskDoc) {

  var cmd = makeCmd(_.cloneDeep(taskDoc))
  if (tipe.isError(cmd)) return cmd
  var taskTag = String(Math.floor(Math.random() * 100000))

  // Add our own final callback the first time run
  taskDoc.args.push(function(err, results) {
    if (err) logErr('Error running task ' + taskDoc.name + ' tag: ' + taskTag, err)
    else {
      if (taskDoc.log) {
        log('Results from task ' + taskDoc.name + ' tag: ' + taskTag, results)
      }
    }
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


// Process task messages from the cluster master.
process.on('message', function msgStartTasks(msg) {

  // This message should only be received by one worker on
  // cluster startup, and again if the task worker dies and
  // a new task worker is chosen by the master.
  if (msg.becomeTaskMaster) {
    util.config.isTaskMaster = true
    if (msg.startTasks) {
      _startAll(function(err, data) {
        if (err) logErr(err)
        else {
          log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks')
        }
      })
    }
    else log('Not starting recurring tasks\n')
  }

  // No other messages are actionable unless this worker is the taskMaster
  if (!util.config.isTaskMaster) return

  if (msg.startTask) {
    _start(msg.startTask, {}, function(err, taskDoc) {
      if (err) logErr(err)
      log('Worker ' + cluster.worker.id + ' started recurring task ', taskDoc)
    })
  }

  if (msg.stopTask) {
    _stop(msg.stopTask, function(err) {
      if (err) logErr(err)
      log('Worker ' + cluster.worker.id + ' stopped recurring task ' + msg.stopTask)
    })
  }

  if (msg.restartTask) {
    _stop(msg.restartTask, function(err, count) {
      if (err) logErr(err)
      if (!count) return
      _start(msg.restartTask, {}, function(err) {
        if (err) logErr(err)
        else log('Worker ' + cluster.worker.id + ' restarted recurring task ' + msg.restartTask)
      })
    })
  }

  if (msg.startAllTasks) {
    _startAll(function(err, data) {
      if (err) logErr(err)
      else log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks')
    })
  }

  if (msg.stopAllTasks) {
    _stopAll(function(err, data) {
      if (err) logErr(err)
      else log('Worker ' + cluster.worker.id + ' stopped ' + data.count + ' recurring tasks')
    })
  }
})


exports.addRoutes = addRoutes
