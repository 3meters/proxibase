/**
 *  Proxibase alive test
 */

var assert = require('assert')
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var util = require('proxutils')
var log = util.log
var _exports = {}


// Make sure server is alive and responding
exports.getIndexPage = function(test) {
  t.get({}, function(err, res, body) {
    test.done()
  })
}

// Check data info page
exports.getDataPage = function(test) {
  t.get('/data', function(err, res, body) {
    t.assert(body && body.data && body.data.users)
    test.done()
  })
}

// Make sure tests can connect to the db directly
exports.directDbConnection = function(test) {
  var db = testUtil.db
  // don't user t.assert for testing db commands
  assert(db.collection('users'))
  db.collection('users').find().count(function(err, count) {
    assert(count)
    test.done()
  })
}

// Check schema info page
exports.getSchemaPage = function(test) {
  t.get('/schema', function(err, res, body) {
    t.assert(body && body.schemas && body.schemas.user)
    test.done()
  })
}

// Check errors info page
exports.getErrorsPage = function(test) {
  t.get('/errors', function(err, res, body) {
    t.assert(body && body.errors)
    test.done()
  })
}


// Make sure server barfs on body not parsable as JSON
exports.postWithBadJsonInBody = function(test) {
  // We have to do this one with raw requst since our
  // treq util will trap bad json before the request is sent
  var req = {
    uri: testUtil.serverUri + '/v1/data/users',
    method: 'post',
    body: '{data: "This is not JSON"}',
    headers: {'Content-type': 'application/json'},
    strictSSL: false,
  }
  testUtil.request(req, function(err, res) {
    testUtil.check(req, res, 400)
    assert(res.body.error, testUtil.dump(req, res))
    test.done()
  })
}

// Make sure server can find el baño
exports.speakSpanishToMe = function(test) {
  t.get('/aPageThatWillNotBeFound?lang=es', 404, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.message === 'No se ha encontrado')
    test.done()
  })
}

// Test echo
exports.echo = function(test) {
  var rBody = {foo: {bar: {baz: 'foo'}}}
  t.post({
    uri: '/echo',
    body: rBody
  }, function(err, res, body) {
    t.assert(body.foo.bar.baz === rBody.foo.bar.baz)
    test.done()
  })
}

// Make sure public database read works
exports.canReadPublidData = function(test) {
  t.get('/data/places', function(err, res, body) {
    t.assert(body)
    t.assert(body.data)
    t.assert(body.data.length)  // relies on sample data
    test.done()
  })
}
