/*
 *  Proxibase task tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var db = testUtil.db  // monosafe connection
var constants = require('../constants')
var userId
var adminId
var userCred
var adminCred
var taskId
var _exports = {} // for commenting out tests
var later = require('later')

var dbOps = {asAdmin: true}
var sched1 =  later.parse.cron('*/1 * * * * *', true) // every second

var task0 = {
  key: 'task.0',
  name: 'task0',
  schedule: sched1,
  module: 'utils',
  method: 'log',
  args: ['Recurring Task Test: What follows should be an object:', {n1:2, s1:'foo'}]
}


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userId = session._owner
    userCred = 'user=' + userId + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminId = session._owner
      adminCred = 'user=' + adminId + '&session=' + session.key
      test.done()
    })
  })
}

exports.usersCannotPostTasks = function(test) {
  t.post({
    uri: '/admin/tasks?' + userCred,
    body: task0,
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCannotPostTaskMalFormedKey = function(test) {
  var badTask = util.clone(task0)
  badTask.key = 'badKey'
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: badTask,
  }, 400, function(err, res, body) {
    t.assert(body.error)
    test.done()
  })
}

exports.adminCanPostTask = function(test) {
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: task0
  }, function(err, res, body) {
    t.assert(body.task)
    t.assert(body.task.enabled)
    test.done()
  })
}

// This can fail due to timeing problems.
// posting tasks happens asyc, but the call
// back returns immediately.
exports.readTasks = function(test) {
  t.get('/admin/tasks?' + adminCred,
  function(err, res, body) {
    t.assert(body.count === 1)
    t.assert(body.tasks && body.tasks.length === 1)
    t.assert(body.tasks[0].running = true)
    test.done()
  })
}

exports.adminCanDeleteTasks = function(test) {
  t.delete({
    uri: '/admin/tasks/' + task0.key + '?' + adminCred,
  }, function(err, res, body) {
    t.assert(body.count === 1)
    t.get('/admin/tasks?' + adminCred,
    function(err, res, body) {
      t.assert(body.count === 0)
      test.done()
    })
  })
}


var task1 = {
  key:      'task.1',
  name:     'task 1',
  schedule: sched1,
  module:   'utils',
  method:   'db.documents.safeInsert',
  args:     [{name: 'testTaskDoc1'}, {asAdmin: true, tag: 'recurringTask 1'}]
}


// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.insertTaskStartsIt = function(test) {
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: task1
  }, function(err, res, body) {
    isDocGeneratorRunning('testTaskDoc1', function(err, isRunning) {
      t.assert(isRunning)
      test.done()
    })
  })
}

// Update the previous task
exports.updateTaskWorks = function(test) {
  task1.args[0].name = 'testTaskDoc2'
  t.post({
    uri: '/admin/tasks/' + task1.key + '?' + adminCred,
    body: task1
  }, function(err, res, body) {
    t.get('/data/documents?name=testTaskDoc1&' + adminCred,
    function(err, res, body) {
      var cDocs = body.data.length
      t.assert(cDocs)
      setTimeout(function() {
        t.get('/data/documents?name=testTaskDoc1&' + adminCred,
        function(err, res, body) {
          t.assert(body.data)
          t.assert(cDocs === body.data.length)  // proves original task was stopped
          t.get('/data/documents?name=testTaskDoc2&' + adminCred,
          function(err, res, body) {
            t.assert(body.data.length >= 2)  // proves updated task is now active and generating documents
            test.done()
          })
        })
      }, 1500)
    })
  })
}


exports.stopTask = function(test) {
  t.get('/admin/tasks/' + task1.key + '/stop?' + adminCred,
  function(err, res, body) {
    var dbOps = {asAdmin: true, tag: 'tasktest'}
    db.documents.safeFind({name: 'testTaskDoc'}, dbOps, function(err, docs) { // get both 1s and 2s
      var cDocs = docs.length
      setTimeout(function() {
        db.documents.safeFind({name: 'testTaskDoc'}, dbOps, function(err, docs) {
          t.assert(cDocs === docs.length) // No new documents have been added since we stopped task1
          test.done()
        })
      }, 1500)
    })
  })
}


var task3

// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.insertDisabledTaskDoesNotStartIt = function(test) {
  task3 = util.clone(task1)
  task3.key = 'task.3'
  task3.name = 'task 3'
  task3.args[0].name = 'testTaskDoc3'
  task3.enabled = false
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: task3,
  }, function(err, res, body) {
    t.get('/admin/tasks/' + task3.key + '?' + adminCred,
    function(err, res, body) {
      // task exists but is not running
      t.assert(body.task)
      t.assert(body.task.running === false)
      setTimeout(function() {
        t.get('/find/documents?name=testTaskDoc3&' + adminCred,
        function(err, res, body) {
          t.assert(body.data.length === 0)
          t.get('/admin/tasks/' + task3.key + '?' + adminCred,
          function(err, res, body) {
            t.assert(body.task)
            t.assert(body.task.enabled === false)
            t.assert(body.task.running === false)
            test.done()
          })
        })
      }, 1500)
    })
  })
}

exports.enablingADisabledTestStartsIt = function(test) {
  task3.enabled = true
  t.post({
    uri: '/admin/tasks/' + task3.key + '?' + adminCred,
    body: task3
  }, function(err, res, body) {
    isDocGeneratorRunning(task3.args[0].name, function(err, isRunning) {
      t.assert(isRunning)
      t.get('/admin/tasks/' + task3.key + '?' + adminCred,
      function(err, res, body) {
        t.assert(body.task)
        t.assert(body.task.enabled === true)
        t.assert(body.task.running === true)
        test.done()
      })
    })
  })
}

exports.stopAll = function(test) {
  t.get('/admin/tasks/stop?' + adminCred,
  function(err, res, body) {
    isDocGeneratorRunning('testTaskDoc', function(err, isRunning) {   // all of them
      t.assert(!isRunning)
      t.get('/admin/tasks?' + adminCred,
      function(err, res, body) {
        t.assert(body.tasks && body.tasks.length)
        body.tasks.forEach(function(task) {
          t.assert(task.running === false)
        })
        test.done()
      })
    })
  })
}

exports.startAll = function(test) {
  t.get('/admin/tasks/start?' + adminCred,
  function(err, res, body) {
    isDocGeneratorRunning('testTaskDoc', function(err, isRunning) {   // all of them
      t.assert(isRunning)
      t.get('/admin/tasks?' + adminCred,
      function(err, res, body) {
        t.assert(body.tasks && body.tasks.length)
        body.tasks.forEach(function(task) {
          t.assert(task.running === true)
        })
        t.get('/admin/tasks/stop?' + adminCred,
        // Leave them off
        function(err, res, body) {
          test.done()
        })
      })
    })
  })
}


// Enable this test to intentionally hang the server open to inspect if necessary
_exports.leaveServerRunning = function(test) {
  // note no test.done()
}


// Async helper to test whether a doc generator task is running or not
function isDocGeneratorRunning(docName, cb) {
  var cDoc = 0
  var dbOps = {
    asAdmin: true,
    name: docName,
    count: true,
    tag: 'tasktest',
  }
  db.documents.safeFind({}, dbOps, function(err, count) {
    if (err) throw err
    cDoc = count
    setTimeout(function() {
      db.documents.safeFind({}, dbOps, function(err, count) {
        if (err) throw err
        cb(null, (count > cDoc))
      })
    }, 1500)
  })
}
