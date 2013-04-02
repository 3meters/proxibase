/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in schema.
 * May modify the object via the defaults param in the schema, but
 * does not modify the schema. Recurses for fields of type object.
 *
 * TODO:  schemas are assumed to be valid.  Once the checker 
 *  is solid, use it to test the schemas against a meta-schema
 *
 * Consider: an asyncronous option or an async wrapper
 *
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

/*
// Meta schema
var _schema = {
  type: {type: 'string'},
  required: {type: 'boolean'},
  default: {},
  value: {},
}
*/

function check(value, schema, options) {

  if (!isObject(schema)) {
    return perr.missingParam('schema must be an object')
  }

  options = options || {}
  options.rootValue = value
  options.rootSchema = schema
  options.strict = options.strict || false

  var err = _check(value, schema, options)
  if (err) err.validArguments = schema
  return err
}


function _check(value, schema, options) {

  options.key = options.key || ''
  if (schema.required && (isUndefined(value) || isNull(value))) {
    return perr.missingParam(options.key, schema)
  }

  // Check an object
  if (isObject(value)) {

    // Fail on unrecognized keys
    if (options.strict) {
      for (var key in value) {
        if (!schema[key]) return perr.badParam(key, schema)
      }
    }

    for (var key in schema) {
      // Set defaults
      if (schema[key].default && isUndefined(value[key])) {
        value[key] = schema[key].default
      }
      // Check required
      if (schema[key].required &&
          (isUndefined(value[key]) || isNull(value[key]))) {
        return perr.missingParam(options.key, schema)
      }
    }

    // Check elements
    for (var key in value) {
      options.key = key
      var err = _checkVal(value[key], schema[key], options)
      if (err) return err
    }
  }
  else {
    // Check a simple scalar
    return _checkVal(value, schema, options)
  }
  return null // success
}


function _checkVal(value, schema, options) {

  if (!isObject(schema)) return null

  if (isObject(value) && isObject(schema.value)) {
    // Nested schema
    return _check(value, schema.value, options)
  }

    // Check type
  if (schema.type && !isUndefined(value) &&
      !util.match(type(value), schema.type)) { // match accepts |-delimited targets
    return perr.badType(options.key + ': ' + schema.type, schema)
  }


  switch (type(schema.value)) {
    case 'undefined':
      break
    case 'function':
      // Call validator function. Validators return null on
      // success, an Error on failure. Perform cross-key
      // validation using optional params object and key
      var err = schema.value(value, options.rootValue, options.key)
      if (err) return err
      break
    case 'string':
      if (!util.match(value, schema.value)) {
        return perr.badValue(options.key + ': ' + schema.value, schema)
      }
      break
    case 'number':
    case 'boolean':
      if (schema.value !== value) {
        return perr.badValue(options.key + ': ' + schema.value, schema)
      }
      break
    default:
      return perr.serverError('Invalid call to check, unsupported ' +
          'value type: ' + schema.value, schema)
  }
  return null // success
}

module.exports = check
