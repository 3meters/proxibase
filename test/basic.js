/*
 * Proxibase basic test
 */

var
  assert = require('assert'),
  req = require('request'),
  log = require('../lib/log'),
  config = require('../config'),
  baseUri = "https://api." + config.host + ":" + config.port + "/";
  log('\nTesting ' + baseUri);


exports.hello = function(test) {
  req(baseUri, function(err, res) {
    assert.ok(res && res.statusCode, 'Fatal: could not reach server');
    assert.ok(res.statusCode === 200, 'Fatal: unexpected status code from base server');
    test.done();
  });
};

exports.getUsers = function(test) {
  req(baseUri + 'users', function(err, res, body) {
    body = JSON.parse(body);
    test.ok(res && res.statusCode === 200, 'Server running but not OK');
    test.ok(body.data instanceof Array, 'body.data is not an array');
    test.done();
  });
}


