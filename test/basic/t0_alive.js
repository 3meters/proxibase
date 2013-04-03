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

exports.checkFailsNicelyOnEmpty = function(test) {
  t.post({
    uri: '/check',
    body: {}
  }, 400, function(err, res, body) {
    t.assert(body.error)
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.checkBasicSuccedesProperly = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema:  {
        str1: {type: 'string', required: true},
        num1: {type: 'number', required: true},
        boo1: {type: 'boolean', required: true},
        arr1: {type: 'array'},
        obj1: {type: 'object', value: {
          str1: {type: 'string'},
          str3: {type: 'string', default: '345'}
        }},
        num2: {type: 'number', default: 10},
      },
      value: {
        str1: 'hello',
        num1: 1,
        boo1: true,
        // arr1: [],
        obj1: {
          str1: '123',
          str2: '234',
        },
      },
    }
  }, function(err, res, body) {
    t.assert(body.value.num2 === 10)
    t.assert(body.value.obj1.str3 === '345')
    test.done()
  })
}

exports.checkMinimalSuccedes = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {type: 'number', required: true},
      value: 1
    }
  }, function(err, res, body) {
    test.done()
  })
}

exports.checkMissingRequiredScalar = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {type: 'number', required: true},
      value: null
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.checkMissingRequiredObject = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {type: 'object', required: true},
      value: null
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.checkMissingRequiredObject = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {
        s1: {type: 'string'},
        o1: {type: 'object', required: true},
      },
      value: {
        s1: 'foo'
      }
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    t.assert(body.error.validArguments.o1)
    test.done()
  })
}

exports.checkMissingRequiredNestedScalar = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {
        s1: {type: 'string'},
        o1: {type: 'object', required: true, value: {
            s1: {type: 'string', required: true}
          }
        },
      },
      value: {
        s1: 'foo',
        o1: {
          s2: 'I am not s1'
        }
      }
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.1)
    test.done()
  })
}

exports.checkStrictWorks= function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {
        s1: {type: 'string'},
        o1: {type: 'object', required: true, value: {
            s1: {type: 'string', required: true}
          }
        },
      },
      value: {
        s1: 'foo',
        o1: {
          s1: 'I am required',
          s2: 'I am not allowed with strict'
        }
      },
      options: {
        strict: true
      }
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11)
    test.done()
  })
}

exports.checkArrayTypesPass = function(test) {
  t.post({
    uri: '/check',
    body: {
      schema: {
        a1: {type: 'array', value: {type: 'string'}},
        a2: {type: 'array', value: {type: 'object', value: {
                s1: {type: 'string', required: true},
            }}
        },
        o1: {type: 'object', required: true, value: {
            s2: {type: 'string', required: true},
            a3: {type: 'array', required: true, value: {type: 'string'}}
          }
        },
      },
      value: {
        a1: ['123', '456', '789'],
        a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}],
        o1: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
      },
      options: {
        strict: true
      }
    }
  }, 400, function(err, res, body) {
    t.assert(body.error.code === 400.11)
    test.done()
  })
}

