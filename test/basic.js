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
  _data = {
    _id: "tid",
    name: "Test User",
    email: "foo@bar.com"
  },
  _options = {
    uri: _uri,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({data: _data})
  }

log('\nTesting ' + _baseUri)

exports.getUsers = function(test) {
  req.get(_uri, function(err, res, body) {
    assert.ok(res && res.statusCode, 'Fatal: could not reach server') // bail on fail
    test.ok(res.statusCode === 200, 'unexpected status code')
    body = JSON.parse(body)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function(test) {
  req.del(_uri + '/__ids:tid', function(err, res) {
    test.ok(res && res.statusCode && res.statusCode === 200, 'Bad status code')
    test.done()
  })
}

exports.addUser = function(test) {
  var options = _.clone(_options)
  req.post(options, function(err, res, body) {
    test.ifError(err)
    test.ok(res && res.statusCode === 200, "Bad statusCode: " + 
      res.statusCode + "\nres.body:\n" + body)
    body = JSON.parse(body)
    test.ok(body.count && body.count === 1, "Bad count")
    test.ok(body && body.data && body.data instanceof Array, "Missing data")
    test.ok(body.data.length === 1, "Bad data length")
    test.ok(body.data[0]._id && body.data[0]._id === _data._id, "Bad _id")
    test.done()
  })
}

exports.checkUser = function(test) {
  req.get(_uri + "/__ids:tid", function(err, res, body) {
    test.ok(res && res.statusCode && res.statusCode === 200, "Bad statusCode")
    body = JSON.parse(body)
    test.ok(body && body.count && body.count === 1, "Bad count")
    test.ok(body.data && body.data && body.data instanceof Array, "Missing data")
    test.ok(body.data[0].name && body.data[0].name === _data.name, 'Bad name')
    test.done()
  })
}


