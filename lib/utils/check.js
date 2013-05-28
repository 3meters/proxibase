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
var tipe = util.type
var isObject = tipe.isObject
var isArray = tipe.isArray
var isString = tipe.isString
var isNull = tipe.isNull
var isUndefined = tipe.isUndefined
var perr = util.perr


// Meta schema
var _schema = {
  type:     { type: 'string' },
  required: { type: 'boolean' },
  default:  { },
  value:    { type: 'string|number|boolean|object|function' },
  comment:  { type: 'string' },
  ref:      { type: 'string' },
  strict:   { type: 'boolean' },
}


// Public entry point
function check(value, schema, options) {
  var err = checkSchema(schema)
  if (err) return err

  options = options || {}
  options.strict = options.strict || false  // allow non-specified fields
  options.ignoreDefaults = options.ignoreDefaults || false
  options.ignoreRequired = options.ignoreRequired || false
  options.doNotCoerce = options.doNotCoerce || false
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

  // Set defaults
  if (!options.ignoreDefaults &&
      schema.default && isUndefined(value)) { // null is not overridden
    value = util.clone(schema.default)
  }

  // Check required
  if (!options.ignoreRequired &&
      schema.required &&
      (isUndefined(value) || isNull(value))) {
    return perr.missingParam(options.key, {value: value, schema: schema})
  }


  // Check an object
  if (isObject(value)) {

    // Fail on unrecognized keys
    // schema option overrides global option
    var beStrict = (isUndefined(schema.strict))
      ? options.strict
      : schema.strict
    if (beStrict) {
      for (var key in value) {
        if (!schema[key]) {
          log('debug check:')
          log('value', value)
          log('schema', schema)
          log('key', key)
          return perr.badParam(key, {value: value, schema: schema})
        }
      }
    }

    for (var key in schema) {

      // skip schema attributes
      if (!schema[key].type) continue

      // Set defaults
      if (!options.ignoreDefaults &&
          schema[key].default && isUndefined(value[key])) { // null is not overridden
        value[key] = util.clone(schema[key].default)
      }

      // Check required
      if (!options.ignoreRequired &&
          schema[key].required &&
          (isUndefined(value[key]) || isNull(value[key]))) {
        return perr.missingParam(key, {
          value: value, schema: schema
        })
      }

      // Coerce stings to numbers and booleans
      if (!options.doNotCoerce && isString(value[key])) {
        value[key] = coerce(value[key], schema[key])
      }
    }

    // Check elements
    for (var key in value) {
      options.key = key
      var err = checkValue(value[key], schema[key], options)
      if (err) return err
    }
  }
  else if (isArray(value) && schema.type === 'array') {
    value.forEach(function(elm) {
      err = checkObject(elm, schema.value, options)
      if (err) return err
    })
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

  // Set defaults
  if (!options.ignoreDefaults &&
      schema.default && isUndefined(value)) { // null is not overridden
    value = util.clone(schema.default)
  }

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
    value.forEach(function(elm) {
      err = checkObject(elm, schema.value, options)
      if (err) return
    })
    return err
  }

  // Check type, matching |-delimited target, i.e. 'string|number|boolean'
  if (schema.type && !isUndefined(value) && !isNull(value) &&
      !util.match(tipe(value), schema.type)) {
    return perr.badType(options.key + ': ' + schema.type, {
      value: value,
      schema: schema,
    })
  }

  switch (tipe(schema.value)) {

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
        return perr.badValue(options.key + ': ' + schema.value, {value: value, schema: schema})
      }
      break

    case 'number':
    case 'boolean':
      if (schema.value !== value) {
        return perr.badValue(options.key + ': ' + schema.value, {value: value, schema: schema})
      }
      break

    default:
      return perr.serverError('Invalid call to check, unsupported ' +
          'value type: ' + schema.value, {value: value, schema: schema})
  }
  return null // success
}


// Query string params usually arrive parsed as strings
// If the schema type is number or boolean cooerce
function coerce(value, schema) {
  if (!isString(value)) return new Error('Expected value of type string')
  switch(schema.type) {
    case 'number':
      var f = parseFloat(value)
      var i = parseInt(value)
      if (Math.abs(f) > Math.abs(i)) value = f
      else if (i) value = i
      if (value === '0') value = 0
      break
    case 'boolean':
      value = util.truthy(value)
      break
  }
  return value
}

module.exports = check
