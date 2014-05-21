/*
 *  Proxibase task tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
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
  name: 'task0',
  schedule: sched1,
  module: 'utils',
  method: 'log',
  args: ['Recurring Task Test: What follows should be an object:', {n1:2, s1:'foo'}]
}

var task0Id = null


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
    uri: '/data/tasks?' + userCred,
    body: { data: task0 }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCanPostTasks = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: task0 }
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data._id)
    task0Id = body.data._id
    test.done()
  })
}


exports.adminCanDeleteTasks = function(test) {
  t.delete({
    uri: '/data/tasks/' + task0Id + '?' + adminCred,
  }, function(err, res, body) {
    test.done()
  })
}


var task1 = {
  name:     'task1',
  schedule: sched1,
  module:   'utils',
  method:   'db.documents.safeInsert',
  args:     [{name: 'testTaskDoc1'}, {asAdmin: true}]
}

var task1Id = null

// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.taskWorks = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: task1 }
  }, 201, function(err, res, body) {
    task1Id = body.data._id
    setTimeout(function(){
      t.get('/data/documents?name=testTaskDoc1&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length >= 2)
        test.done()
      })
    }, 1500)
  })
}


// Update the previous task
exports.restUpdateTaskWorks = function(test) {
  var task2 = util.clone(task1)
  task2.args[0].name = 'testTaskDoc2'
  t.post({
    uri: '/data/tasks/' + task1Id + '?' + adminCred,
    body: { data: task2}
  }, function(err, res, body) {
    t.assert(task1Id === body.data._id)  // the task record was updated, not inserted
    // make sure the orginal task was stopped
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
    uri: '/data/tasks/' + task1Id + '?' + adminCred,
  }, function (err, res, body) {
    t.get('/data/tasks?' + adminCred, function(err, res, body) {
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
    uri: '/data/tasks?' + adminCred,
    body: { data: task3 },
  }, 201, function(err, res, body) {
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
  test.done()
}
