/**
 * Migrate from version 8 to version 9 schema
 */

var r = require('request')
  .defaults({
    json: true,
    strictSSL: false,
  })
var assert = require('assert')
var util = require('proxutils')
var log = util.log

var oldUri = 'https://localhost:5543'
var oldUri = 'https://api.aircandi.com'
var newUri = 'https://localhost:6643'
var oldCred = ''
var newCred = ''

function getCred(uri, cb) {
  r.post({
    uri: uri + '/auth/signin',
    body: {
      user: {
        email: 'admin',
        password: 'admin',
      }
    }
  }, function(err, res, body) {
    if (err) throw err
    var session = body.session
    assert(session)
    cb(null, 'user=' + session._owner + '&session=' + session.key)
  })
}

function signin(cb) {
  getCred(oldUri, function(err, cred) {
    oldCred = cred
    getCred(newUri, function(err, cred) {
      newCred = cred
      cb()
    })
  })
}

signin(function() {
  log('oldCred: ' + oldCred)
  log('newCred: ' + newCred)
})


