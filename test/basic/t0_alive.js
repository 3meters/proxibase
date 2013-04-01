/**
 *  Proxibase alive test
 */

var assert = require('assert')
var testUtil = require('../util')
var t = testUtil.treq
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
exports.postWithMissingBody = function(test) {
  t.post('/do/find', 400, function(err, res, body) {
    t.assert(body.error)
    test.done()
  })
}


// Make sure server barfs on body not parsable as JSON
exports.postWithBadJsonInBody = function(test) {
  // We have to do this one with raw requst since our
  // treq util will trap bad json before the request is sent
  var req = {
    uri: testUtil.serverUrl + '/data/users',
    method: 'post',
    body: '{data: "This is not JSON"}',
    headers: {'Content-type': 'application/json'}
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

exports.checkGetWorks = function(test) {
  t.get('/check', function(err, res, body) {
    t.assert(body.info)
    test.done()
  })
}

_exports.checkFailsNicelyOnEmpty = function(test) {
  t.post({
    uri: '/check',
    body: {}
  }, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.code === 400.1)
    t.assert(body.error.info)
    t.assert(body.error.info.param)
    t.assert(body.error.info.template)
    test.done()
  })
}

exports.checkBasicSuccedesProperly = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema:  {
        arr1: {type: 'array', required: true},
        obj1: {type: 'object', value: {
          str1: {type: 'string'},
        }},
        str2: {type: 'object'},
        num1: {type: 'number', default: 10000},
        boo1: {type: 'boolean'}
      },
      value: {
        arr1: [],
        obj1: {
          str1: '123',
        },
      },
    }
  }, function(err, res, body) {
    test.done()
  })
}

exports.checkMinimalSuccedes = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {type: 'number', required: true}
      value: 1
    }
  }, function(err, res, body) {
    test.done()
  })
}

