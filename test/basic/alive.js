/*
 *  Proxibase alive test
 */

var
  assert = require('assert'),
  request = require('request'),
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  log = require('../../lib/util').log


// Make sure server is alive and responding
exports.getIndexPage = function(test) {
  req.method = 'get'
  req.uri = baseUri
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}


// Check data info page
exports.getDataPage = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.data && res.body.data.users, dump(req, res))
    test.done()
  })
}


// Check schema info page
exports.getSchemaPage = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/schema'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.schema && res.body.schema.users, dump(req, res))
    test.done()
  })
}


// Check errors info page
exports.getErrorsPage = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/errors'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body && res.body.errors, dump(req, res))
    test.done()
  })
}


// Make sure server barfs on post without body
exports.postWithMissingBody = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  delete req.body
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}


// Make sure server barfs on body not parsable as JSON
exports.postWithBadJsonInBody = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users'
  req.body = '{data: "This is not JSON"}'
  request(req, function(err, res) {
    check(req, res, 400)
    assert(res.body.error, dump(req, res))
    test.done()
  })
}

// Make sure server can find el baño
exports.speakSpanishToMe = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/yadayadayada?lang=es'
  request(req, function(err, res) {
    check(req, res, 404)
    assert(res.body.error, dump(req, res))
    assert(res.body.error.message === 'No se ha encontrado') // see lib/httperr.js
    test.done()
  })
}

