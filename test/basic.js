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
  _options = {
    uri: _uri,
    headers: {
      "content-type": "application/json"
    }
  }

log('\nTesting ' + _baseUri)

exports.getUsers = function(test) {
  req(_uri, function(err, res, body) {
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
  options.body = JSON.stringify({
    data: {
      _id: "tid",
      name: "Test User",
      email: "foo@bar.com"
    }
  })
  req.post(options, function(err, res, body) {
    test.ifError(err)
    test.ok(res && res.statusCode === 200, "Bad statusCode: " + 
      res.statusCode + "\nres.body:\n" + body)
    body = JSON.parse(body);
    test.ok(body.data && body.data._id && body.data._id === "tid", "Bad _id")
    test.done()
  })
}

