/*
 *  Proxibase task tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var constants = require('../constants')
var userCred
var adminCred
var staticVersion = util.statics.clientVersion
var _exports = {} // for commenting out tests


// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function (test) {
  testUtil.getUserSession(function(session) {
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}

var sched1 = {"s": [0,1,2]}

var task1 = {
  "schedule":{
    "schedules": [ sched1 ]
  },
  "module":"utils",
  "method":"log",
  "args": ["What follows should be an object:", {"n1":2,"s1":"foo"}]
}

var task2 = {
  "schedule":{
    "schedules": [ sched1 ]
  },
  "module":"utils",
  "method":"db.documents.safeInsert",
  "args": [{"type":"taskTest"}]
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
    test.done()
  })
}

exports.dbCommandsWork = function(test) {
  t.post({
    uri: '/data/tasks?' + adminCred,
    body: { data: task2 }
  }, 201, function(err, res, body) {
    setTimeout(function(){
      t.get('/data/documents?find[type]=taskTest',
        function(err, res, body) {
          t.assert(3 === body.length)
          test.done()
        })
    }, 4000)
  })
}
