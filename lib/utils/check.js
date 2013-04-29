/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in schema.
 * May modify the object via the defaults param in the schema, but
 * does not modify the schema. Recurses for fields of type object.
 *
 * Consider: an asyncronous option or an async wrapper
 *
 */

var util = require('./')
var type = util.type
var isObject = type.isObject
var isArray = type.isArray
var isString = type.isString
var isNull = type.isNull
var isUndefined = type.isUndefined
var perr = util.perr


// Meta schema
var _schema = {
  type:     { type: 'string' },
  required: { type: 'boolean' },
  default:  { },
  value:    { type: 'string|number|boolean|object|function' },
  comment:  { type: 'string' },
  ref:      { type: 'string' },
}


// Public entry point
function check(value, schema, options) {
  var err = checkSchema(schema)
  if (err) return err

  options = options || {}
  options.strict = options.strict || false  // allow non-specified fields
  options.ignoreDefaults = options.ignoreDefaults || false
  options.ignoreRequired = options.ignoreRequired || false
  options.coerceStrings = options.coerceStrings || false
  options.untrusted = options.untrusted || false
  options.rootValue = value
  options.rootSchema = schema

  err = checkObject(value, schema, options)
  if (err) err.validArguments = schema
  return err
}


// Validate schema against meta schema
function checkSchema(schema) {
  var err
    if (!isObject(schema)) {
    return perr.missingParam('schema must be an object')
  }

  for (var key in schema) {
    var err = checkObject(schema[key], _schema, {strict: true})
    if (err) {
      // try a scalar-targeted schema
      var err2 = checkObject(schema, _schema, {strict: true})
      if (err2) return perr.badValue('Invalid schema: ' + err.message, schema)
    }
  }
  return null
}


// Check all schema attributes except value
// Can modify value by setting defaults
// Value can be an object or a scalar
function checkObject(value, schema, options) {

  options.key = options.key || ''

  // Check required
  if (!options.ignoreRequired &&
      schema.required &&
      (isUndefined(value) || isNull(value))) {
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
      if (!options.ignoreDefaults &&
          schema[key].default && isUndefined(value[key])) { // null is not overridden
        value[key] = schema[key].default
      }
      // Check required
      if (!options.ignoreRequired &&
          schema[key].required &&
          (isUndefined(value[key]) || isNull(value[key]))) {
        return perr.missingParam(key, schema)
      }
    }

    // Check elements
    for (var key in value) {
      options.key = key
      var err = checkValue(value[key], schema[key], options)
      if (err) return err
    }
  }
  else {
    // Check a simple scalar
    return checkValue(value, schema, options)
  }
  return null // success
}


// Check value against a simple rule, a specified validator
// function, or via a recusive nested schema call
function checkValue(value, schema, options) {

  if (!isObject(schema)) return null  // success

  if (isNull(value) || isUndefined(value)) return null // success

  // Nested object
  if (isObject(value) && isObject(schema.value)) {
    var err = checkSchema(schema.value)
    if (err) return err
    return checkObject(value, schema.value, options)
  }

  // Nested array
  if (isArray(value) && isObject(schema.value)) {
    var err = checkSchema(schema.value)
    if (err) return err
    value.forEach(function(elem) {
      err = checkObject(elem, schema.value, options)
      if (err) return
    })
    return err
  }

  // Check type, matching |-delimited target, i.e. 'string|number|boolean'
  if (schema.type && !isUndefined(value) && !isNull(value) &&
      !util.match(type(value), schema.type)) {
    var coerced = false
    // query string params usually come parsed as strings
    // optionally try to coerce strings to numbers or booleans
    if (options.coerceStrings && type.isString(value)) {
      if (schema.type === 'number') {
        if (parseInt(value)) {
          value = parseInt(value)
          coerced = true
        }
      }
      if (schema.type === 'boolean') {
        value = util.truthy(value)
        coerced = true
      }
    }
    if (!coerced) {
      return perr.badType(options.key + ': ' + schema.type, schema)
    }
  }

  switch (type(schema.value)) {

    case 'undefined':
      break

    case 'function':
      // Set by the public web method to ensure that we don't run
      // arbitrary code uploaded from outside
      if (options.untrusted) {
        return perr.forbidden('function validators not allowed')
      }
      // Call the validator function. Validators must return null
      // on success or an Error on failure. Perform cross-key
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
