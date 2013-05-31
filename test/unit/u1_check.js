/**
 * util/check unit test
 */

var assert = require('assert')
var util = require('proxutils')
var log = util.log
var tipe = util.type
var check = util.check

var sch = function() {

  var schema = {
    s1: { type: 'string', required: true },
    s2: { type: 'string', default: 'hi' },
    o1: { type: 'object', value: {
      s1: {type: 'string'},
      n1: {type: 'number'},
      b1: {type: 'boolean'},
    }},
    o2: {
      type: 'object', value: {
        no1: {type: 'object', value: {
          s1: { type: 'string', value: 'foo'}
        }}
      }
    },
    o3: {type: 'object', required: true, value: {
        s2: {type: 'string', required: true},
        a3: {type: 'array', required: true, value: {type: 'string'}}
      },
    },
    a1: {type: 'array', value: {type: 'string'}},
    a2: {type: 'array', value: {type: 'object', value: {
            s1: {type: 'string', required: true},
        }}
    },
  }
  return util.clone(schema)
}

var val = function() {
  var value = {
    s1: 'hello',
    o1: { s1: 'foo', n1: 1, b1: true },
    o2: { no1: { s1: 'foo', } },
    o3: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
    a1: ['123', '456', '789'],
    a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}, {s1: 'barney'}],
  }
  return util.clone(value)
}

exports.BasicCheckPasses = function(test) {
  var value = val()
  var schema = sch()
  var err = check(value, schema, {strict: true})
  if (err) throw err
  assert(value.s2)
  assert(value.s2 === 'hi')
  test.done()
}