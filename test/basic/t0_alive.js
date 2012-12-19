/*
 *  Proxibase alive test
 */

var assert = require('assert')
var request = require('request')
var testUtil = require('../util')
var check = testUtil.check
var dump = testUtil.dump
var t = testUtil.T
var Req = testUtil.Req
var log = require('util').log
var _exports = {}


// Make sure server is alive and responding
exports.getIndexPage = function(test) {
  var req = new Req({method: 'get'})
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

_exports.foo = function(test) {
  t.req({method: 'get'}, 200, function(err, res) {
    test.done()
  })
}


// Check data info page
exports.getDataPage = function(test) {
  var req = new Req({method: 'get', uri: '/data'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data.users, dump(req, res))
    test.done()
  })
}


// Check schema info page
exports.getSchemaPage = function(test) {
  var req = new Req({method: 'get', uri: '/schema'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.schemas && res.body.schemas.users, dump(req, res))
    test.done()
  })
}


// Check errors info page
exports.getErrorsPage = function(test) {
  var req = new Req({method: 'get', uri: '/errors'})
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.errors, dump(req, res))
    test.done()
  })
}


// Make sure server barfs on post without body
//   default method for Req is post, not get
exports.postWithMissingBody = function(test) {
  var req = new Req({ uri: '/do/find' })
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}


// Make sure server barfs on body not parsable as JSON
exports.postWithBadJsonInBody = function(test) {
  var req = new Req({ uri: '/data/users', })
  req.body = '{data: "This is not JSON"}'
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}

// Make sure server can find el baño
exports.speakSpanishToMe = function(test) {
  var req = new Req({method: 'get', uri: '/aPageThatWillNotBeFound?lang=es'})
  request(req, function(err, res) {
    check(req, res, 404)
    assert(res.body.error, dump(req, res))
    assert(res.body.error.message === 'No se ha encontrado') // see lib/extend/error.js
    test.done()
  })
}

