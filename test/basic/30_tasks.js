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
var docCount
var staticVersion = util.statics.clientVersion
var _exports = {} // for commenting out tests
var later = require('later')

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
  args:     [{name: 'testTaskDoc1'}, {asAdmin: true}]
}


// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.insertTaskStartsIt = function(test) {
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: task1
  }, function(err, res, body) {
    setTimeout(function(){
      t.get('/data/documents?name=testTaskDoc1&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length >= 2)
        test.done()
      })
    }, 1500)
  })
}

exports.stopTaskWorks = function(test) {
  t.get('/admin/tasks/' + task1.key + '/stop?' + adminCred,
  function(err, res, body) {
    var cDocs = 0
    db.documents.safeFind({name: 'testTaskDoc1'}, {asAdmin: true}, function(err, docs) {
      cDocs = docs.length
      setTimeout(function() {
        db.documents.safeFind({name: 'testTaskDoc1'}, {asAdmin: true}, function(err, docs) {
          t.assert(cDocs === docs.length) // No new documents have been added since we stopped task1
          test.done()
        })
      }, 1500)
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
      var cDocsAddedByTask1 = body.data.length
      t.assert(cDocsAddedByTask1)
      setTimeout(function() {
        t.get('/data/documents?name=testTaskDoc1&' + adminCred,
        function(err, res, body) {
          t.assert(body.data)
          t.assert(cDocsAddedByTask1 === body.data.length)  // proves task2 was cleared by update
          t.get('/data/documents?name=testTaskDoc2&' + adminCred,
          function(err, res, body) {
            t.assert(body.data.length >= 2)
            test.done()
          })
        })
      }, 1500)
    })
  })
}


exports.stopTask = function(test) {
  t.delete({
    uri: '/admin/tasks/' + task1Id + '?' + adminCred,
  }, function (err, res, body) {
    t.get('/admin/tasks?' + adminCred, function(err, res, body) {
      t.assert(body.data && 0 === body.data.length)  // all tasks records are gone
      t.get('/data/documents?name=testTaskDoc&' + adminCred,  // will find the 1s and the 2s
      function(err, res, body) {
        t.assert(body.data)
        docCount = body.data.length  // count records inserted by recurring task
        setTimeout(function() {
          t.get('/data/documents?name=testTaskDoc&' + adminCred,
          function() {
            t.assert(body.data && docCount === body.data.length)  // make sure we have no new records
            test.done()
          })
        }, 1500)
      })
    })
  })
}


// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.insertDisabledTaskDoesNotStartIt = function(test) {
  var task3 = util.clone(task1)
  task3.args[0].name = 'testTaskDoc3'
  task3.enabled = false
  t.post({
    uri: '/admin/tasks?' + adminCred,
    body: { data: task3 },
  }, function(err, res, body) {
    setTimeout(function(){
      t.get('/find/documents?name=testTaskDoc3&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length === 0)
        test.done()
      })
    }, 1500)
  })
}

exports.leaveServerRunning = function(test) {
  // Comment this out the next line hang the test leaving the test server running
  // With its global state alive
  test.done()
}
