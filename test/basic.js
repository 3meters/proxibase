/*
 * Proxibase basic test
 */

// Just say yummy to module globals in tests
var
  assert = require('assert'),
  util = require('util'),
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

function parse(res, code) {
  // works if named function is called directly, but not from nodeunit
  // var caller = arguments.callee.caller.name || 'unknown'
  code = code || 200
  assert(res && res.statusCode && res.statusCode === code, "Bad statusCode")
  res.body = JSON.parse(res.body)
  assert(res.body && res.body.count === parseInt(res.body.count), "Bad body.count") // 0 is ok
  if (res.body.data) assert(res.body.data instanceof Array, "Bad body.data")
}

log('\nTesting ' + _baseUri)

exports.getUsers = function (test) {
  req.get(_uri, function(err, res) {
    parse(res)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function delUsers2(test) {
  req.del(_uri + '/__ids:tid', function(err, res) {
    parse(res)
    test.done()
  })
}

exports.addUser = function(test) {
  var options = _.clone(_options)
  req.post(options, function(err, res) {
    parse(res)
    assert(res.body.count === 1)
    assert(res.body.data[0]._id && res.body.data[0]._id === _body.data._id)
    test.done()
  })
}

exports.checkUser = function(test) {
  req.get(_uri + "/__ids:tid", function(err, res) {
    parse(res)
    assert(res.body.data[0].name && res.body.data[0].name === _body.data.name)
    test.done()
  })
}

exports.updateUser = function(test) {
  var options = _.clone(_options)
  var body = _.clone(_body)
  body.data.name = 'Test User2'
  options.body= JSON.stringify(body)
  options.uri = _uri + '/__ids:' + _body.data._id
  req.post(options, function(err, res) {
    parse(res)
    assert(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.get(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    assert(res.body.data[0].name === 'Test User2')
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.del(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    assert(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUserDeleted = function(test) {
  req.get(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    assert(res.body.count === 0)
    test.done()
  })
}
