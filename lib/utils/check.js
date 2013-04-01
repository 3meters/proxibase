/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in schema.
 * May modify the object via the defaults param in the schema, but
 * does not modify the schema. Recurses for fields of type object.
 *
 * Consider: an asyncronous option or an async wrapper
 */

var _ = require('underscore')
var util = require('./')
var type = util.type
var isObject = type.isObject
var isArray = type.isArray
var isString = type.isString
var isNull = type.isNull
var isUndefined = type.isUndefined
var perr = util.perr

function check(value, schema, options) {
  var err = null

  options = options || {
    strict: false,
  }

  switch (type(value)) {
    case 'object':
      if (options.strict) { // error on unrecognized keys
        for (var key in value) {
          if (!schema[key]) return perr.badParam(key, schema)
        }
      }
      break
    case 'array':
      return new Error('array values are not yet supported')
      break
    default:
      return checkScalar(value, schema, options)
  }

  var err
  for (var key in schema) {
    err = checkVal(value[key], schema[key], key)
    if (err) return err
    // Set defaults
    if (schema[key].default && isUndefined(value[key])) {
      value[key] = schema[key].default
    }
  }

  // Check invidiual values against their schema. The outer
  function checkScalar(value, schema, key) {

    if (isObject(schema.value) && isObject(val)) { // recurse
      return check(val, schema.value, options)
    }

    key = key || ''

    // Check required
    if (schema.required &&
        (isUndefined(val) || isNull(val))) {
      return perr.missingParam(key, schema)
    }

    // Invalid schema
    if (schema.type && !isString(schema.type)) {
      var msg = 'Invalid schema.' + key +
          '.type must be a string'
      return perr.serverError(msg, schema)
    }

    // Check type
    if (schema.type && !isUndefined(val) &&
        !util.match(type(val), schema.type)) {
      return perr.badType(key + ': ' + schema.type, schema)
    }

    // Check value: value can be a scalar, a pipe-separated string,
    // or a validator function. TODO: arrays
    switch (type(schema.value)) {
      case 'undefined':
      case 'object':
        break
      case 'function':
        // Call validator function. Validators return null on
        // success, an Error on failure. Perform cross-key
        // validation using optional params object and key
        var err = schema.value(val, value, key)
        if (err) return err
        break
      /*
      case 'array':
          // Check every element in the array
          var err = val.some(function(val) {
            check(val, schema.value)
          })
          if (err) return err
          break
      */ 
      case 'string':
        if (!util.match(val, schema.value)) {
          return perr.badValue(key + ': ' + schema.value, schema)
        }
        break
      case 'number':
      case 'boolean':
        if (schema.value !== val) {
          return perr.badValue(key + ': ' + schema.value, schema)
        }
        break
      default:
        return perr.serverError('Invalid call to check, unsupported ' +
            'value type: ' + schema.value, schema)
    }
    return null // value success
  }

  return null // module success
}

module.exports = check
