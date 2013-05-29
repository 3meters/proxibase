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
var log = util.log
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

  err = doCheck(value, schema, options)
  if (err) err.validArguments = schema
  return err
}



// Check all schema attributes except value
// Can modify value by setting defaults
// Value can be an object or a scalar
function doCheck(value, schema, options) {

  var err = null

  // log('\ndoCheck key: ' + options.key)
  // log('value', value)
  // log('schema', schema)
  options.key = options.key || ''

  if (!isObject(schema)) return null  // success

  // Schema is nested one level
  if (isObject(value)
      && 'object' === schema.type
      && isObject(schema.value)) {
    schema = schema.value
  }

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

  if (!isObject(value)) {
    return checkValue(value, schema, options)
  }


  // Fail on unrecognized keys
  // schema option overrides global option
  var beStrict = (isUndefined(schema.strict))
    ? options.strict
    : schema.strict
  if (beStrict) {
    for (var key in value) {
      if (!schema[key]) {
        return perr.badParam(key, {value: value, schema: schema})
      }
    }
  }

  for (var key in schema) {

    // skip schema attributes
    if (!schema[key].type) continue

    // Set defaults
    if (!options.ignoreDefaults
        && schema[key].default
        && isUndefined(value[key])) { // null is not overridden
      value[key] = schema[key].default
    }

    // Check required
    if (!options.ignoreRequired &&
        schema[key].required &&
        (isUndefined(value[key]) || isNull(value[key]))) {
      return perr.missingParam(key, {
        value: value, schema: schema
      })
    }
  }


  // Check elements
  for (var key in value) {
    options.key = key

    switch(type(value[key])) {

      case 'object':
        if (schema[key] && schema[key].value) {
          err = doCheck(value[key], schema[key].value, options) // recurse
          if (err) return err
        }
        break

      case 'array':
        if (!schema[key]) break
        if (!util.match('array', schema[key].type)) {
          return perr.badType(value)
        }
        if (schema[key].value) {
          value[key].forEach(function(elm) {
            err = doCheck(elm, schema[key].value, options)
            if (err) return
          })
          if (err) return err
        }
        break

      case 'string':
        // Coerce stings to numbers and booleans
        if (!options.doNotCoerce && schema[key]) {
          value[key] = coerce(value[key], schema[key])
        }
        // fall through to default on purpose

      default:
        err = checkValue(value[key], schema[key], options)
        if (err) return err
    }
  }

  return err
}


// Check value against a simple rule, a specified validator
// function, or via a recusive nested schema call
function checkValue(value, schema, options) {

  // log('\ncheckValue key: ' + options.key)
  // log('value:', value)
  // log('schema:', schema)

  if (!isObject(schema)) return null  // success

  if (isNull(value) || isUndefined(value)) return null // success

  // Set defaults
  if (!options.ignoreDefaults &&
      schema.default && isUndefined(value)) { // null is not overridden
    value = util.clone(schema.default)
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


// Validate schema against meta schema
function checkSchema(schema) {
  var err
    if (!isObject(schema)) {
    return perr.missingParam('schema must be an object')
  }

  for (var key in schema) {
    var err = doCheck(schema[key], _schema, {strict: true})
    if (err) {
      // try a scalar-targeted schema
      var err2 = doCheck(schema, _schema, {strict: true})
      if (err2) return perr.badValue('Invalid schema: ' + err.message, schema)
    }
  }
  return null
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
