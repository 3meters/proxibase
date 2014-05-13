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
var sched2 =  later.parse.cron('*/2 * * * * *', true) // every second second

var task1 = {
  name: 'task1',
  schedule: sched1,
  module: 'utils',
  method: 'log',
  args: ['What follows should be an object:', {n1:2, s1:'foo'}]
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
    uri: '/data/tasks?' + userCred,
    body: { data: task1 }
  }, 401, function(err, res, body) {
    test.done()
  })
}

exports.adminCanPostTasks = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: task1 }
  }, 201, function(err, res, body) {
    t.assert(body.data && body.data._id)
    taskId = body.data._id
    test.done()
  })
}

exports.adminCanUpdateTasks = function(test) {
  var task = util.clone(task1)
  task.schedule = sched2
  t.post({
    uri: '/data/tasks/' + taskId + '?' + adminCred,
    body: { data: task }
  }, function(err, res, body) {
    t.assert(util._.isEqual(body.data.schedule, sched2))
    test.done()
  })
}

exports.adminCanDeleteTasks = function(test) {
  t.delete({
    uri: '/data/tasks/' + taskId + '?' + adminCred,
  }, function(err, res, body) {
    test.done()
  })
}

// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.restInsertAsTaskWorks = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: {
      name:     'task2',
      schedule: sched1,
      module:   'utils',
      method:   'db.documents.safeInsert',
      args:     [{type: 'taskTest2'}, {user: {_id: adminId, role: 'admin'}}]
    }}
  }, 201, function(err, res, body) {
    taskId = body.data._id
    setTimeout(function(){
      t.get('/data/documents?query[type]=taskTest2&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length >= 2)
        test.done()
      })
    }, 1500)
  })
}

// Start a task which inserts one new document per second.
// Wait a couple of seconds and then query the db for those
// documents.
exports.restUpdateTaskWorks = function(test) {
  t.post({
    uri: '/data/tasks/' + taskId + '?' + adminCred,
    body: { data: {
      name:     'task2',
      schedule: sched1,
      module:   'utils',
      method:   'db.documents.safeInsert',
      args:     [{type: 'taskTest2Updated'}, {user: {_id: adminId, role: 'admin'}}]
    }}
  }, function(err, res, body) {
    t.assert(taskId === body.data._id)
    setTimeout(function(){
      t.get('/data/documents?query[type]=taskTest2Updated&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length >= 2)
        test.done()
      })
    }, 1500)
  })
}


exports.canStopInsertTask = function(test) {
  t.delete({
    uri: '/data/tasks/' + taskId + '?' + adminCred,
  }, function (err, res, body) {
    t.get('/data/tasks?' + adminCred, function(err, res, body) {
      t.assert(body.data && 0 === body.data.length)  // all tasks records are gone
      t.get('/data/documents?query[type]=taskTest2&' + adminCred,
      function(err, res, body) {
        t.assert(body.data)
        docCount = body.data.length  // count records inserted by recurring task
        setTimeout(function() {
          t.get('/data/documents?query[type]=taskTest2&' + adminCred,
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
exports.restInsertDisabledTestDoesNotStartIt = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: {
      name:     'task3',
      schedule: sched1,
      module:   'utils',
      method:   'db.documents.safeInsert',
      enabled:  false,
      args:     [{type: 'taskTest3'}, {user: {_id: adminId, role: 'admin'}}]
    }}
  }, 201, function(err, res, body) {
    taskId = body.data._id
    setTimeout(function(){
      t.get('/find/documents?query[type]=taskTest3&' + adminCred,
      function(err, res, body) {
        t.assert(body.data.length === 0)
        test.done()
      })
    }, 1500)
  })
}

exports.insertRebuildStatsTask = function(test) {

  log('There appears to be a problem with disabling tasks not disabling')
  return skip(test)
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: {
      name:     'rebuildStats',
      schedule: later.parse.cron('*/5 * * * * *', true), // every 5 seconds
      module:   'utils',
      method:   'calcStats',
      enabled:  true,
      args:     [{rebuild: true}],
    }}
  }, 201, function(err, res, body) {
    debug('task body', body)
    var taskId = body.data._id
    t.assert(taskId)
    setTimeout(stopStatRebuildTask, 2000)
    function stopStatRebuildTask() {
      t.post({
        uri: '/data/tasks/' + taskId + '?' + adminCred,
        body: {data: {enabled: false}},
      }, function(err, res, body) {
        test.done()
        // manually inspect the log output after the test
        // has finished to confirm that cron called rebuild stats only once
      })
    }
  })
}

