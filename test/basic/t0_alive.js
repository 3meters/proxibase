/*
 *  Proxibase alive test
 */

var testUtil = require('../util')
var t = testUtil.treq
var util = require('utils')
var log = util.log
var _exports = {}


// Make sure server is alive and responding
exports.getIndexPage = function(test) {
  t.get({}, function(err, res) {
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

// Check schema info page
exports.getSchemaPage = function(test) {
  t.get('/schema', function(err, res, body) {
    t.assert(body && body.schemas && body.schemas.users)
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

// Make sure server barfs on post without body
//   default method for Req is post, not get
exports.postWithMissingBody = function(test) {
  t.get('/do/find', 400, function(err, res) {
    t.assert(res.body.error)
    test.done()
  })
}


// Make sure server barfs on body not parsable as JSON
exports.postWithBadJsonInBody = function(test) {
  t.post({
    uri: '/data/users',
    body: '{data: "This is not JSON"}'
  }, 400, function(err, res) {
    t.assert(res.body.error)
    test.done()
  })
}

// Make sure server can find el baño
exports.speakSpanishToMe = function(test) {
  t.get('/aPageThatWillNotBeFound?lang=es', 404, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.message === 'No se ha encontrado') // see lib/extend/error.js
    test.done()
  })
}

