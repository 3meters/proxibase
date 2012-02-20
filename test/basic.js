/*
 * Proxibase basic test
 */

// Just say yummy to module globals in tests
var
  assert = require('assert'),
  req = require('request'),
  _ = require('underscore'),
  log = require('../lib/log'),
  config = require('../config'),
  _baseUri = "https://api." + config.host + ":" + config.port + "/",
  _uri = _baseUri + "users",
  _body = {
    data: {
      _id: "tid",
      name: "Test User",
      email: "foo@bar.com"
    }
  },
  _options = {
    uri: _uri,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(_body)
  }

function checkCode(res, code) {
  code = code || 200
  assert(res && res.statusCode && res.statusCode === code)
}

log('\nTesting ' + _baseUri)

exports.getUsers = function(test) {
  req.get(_uri, function(err, res, body) {
    checkCode(res)
    body = JSON.parse(body)
    assert(body && body.data && body.data instanceof Array)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function(test) {
  req.del(_uri + '/__ids:tid', function(err, res) {
    checkCode(res) // delete unfound record will return statusCode 200
    test.done()
  })
}

exports.addUser = function(test) {
  var options = _.clone(_options)
  req.post(options, function(err, res, body) {
    checkCode(res)
    body = JSON.parse(body)
    assert(body.count && body.count === 1)
    assert(body && body.data && body.data instanceof Array)
    assert(body.data.length === 1)
    assert(body.data[0]._id && body.data[0]._id === _body.data._id)
    test.done()
  })
}

exports.checkUser = function(test) {
  req.get(_uri + "/__ids:tid", function(err, res, body) {
    checkCode(res)
    body = JSON.parse(body)
    assert(body && body.count && body.count === 1)
    assert(body.data && body.data && body.data instanceof Array)
    assert(body.data[0].name && body.data[0].name === _body.data.name)
    test.done()
  })
}

exports.updateUser = function(test) {
  var options = _.clone(_options)
  var body = _.clone(_body)
  body.data.name = 'Test User2'
  options.body= JSON.stringify(body)
  options.uri = _uri + '/__ids:' + _body.data._id
  req.post(options, function(err, res, body) {
    checkCode(res)
    body = JSON.parse(body)
    assert(body && body.count && body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.get(_uri + '/__ids:' + _body.data._id, function(err, res, body) {
    checkCode(res)
    body = JSON.parse(body)
    assert(body && body.data && body.data instanceof Array)
    assert(body.data[0].name === 'Test User2')
    test.done()
  })
}


