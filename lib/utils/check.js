/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in template.
 * May modify the object via the defaults param in the template, but
 * does not modify the template. Recurses for fields of type object.
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

function check(object, template, options) {

  options = options || {
    strict: false,
    allowEmpty: false
  }

  if (!isObject(object)) {
    return perr.badType(object, 'Must be an object')
  }

  // If the method doesn't ordinarily accept empty, the caller
  // can pass in an empty object to generate a quick api doc.
  // Provided for convenience for public web methods.
  if (!_.isEmpty(template) && _.isEmpty(object) && !options.allowEmpty) {
    return perr.missingParam(null, template)
  }

  // option.strict will error on unrecognized keys
  if (options.strict) {
    for (var key in object) {
      if (!template[key]) return perr.badParam(key, template)
    }
  }

  var err
  for (var key in template) {
    err = checkVal(object[key], template[key], key)
    if (err) return err
    // Set defaults
    if (template[key].default && isUndefined(object[key])) {
      object[key] = template[key].default
    }
  }

  // Check invidiual values against their template. The outer
  function checkVal(val, template, key) {

    if (isObject(template.value) && isObject(val)) { // recurse
      return check(val, template.value, options)
    }

    key = key || ''

    // Check required
    if (template.required &&
        (isUndefined(val) || isNull(val))) {
      return perr.missingParam(key, template)
    }

        // Soft assert on the template
    if (template.type && !isString(template.type)) {
      var msg = 'Invalid call to check. template.' + key +
          '.type must be a string'
      return perr.serverError(msg, template)
    }

    // Check type
    if (template.type && !isUndefined(val) &&
        !util.match(type(val), template.type)) {
      return perr.badType(key + ': ' + template.type, template)
    }

    // Check value: value can be a scalar, a pipe-separated string,
    // or a validator function. TODO: arrays
    switch (type(template.value)) {
      case 'undefined':
      case 'object':
        break
      case 'function':
        // Call validator function. Validators return null on
        // success, an Error on failure. Perform cross-key
        // validation using optional params object and key
        var err = template.value(val, object, key)
        if (err) return err
        break
      /*
      case 'array':
          // Check every element in the array
          var err = val.some(function(val) {
            check(val, template.value)
          })
          if (err) return err
          break
      */ 
      case 'string':
        if (!util.match(val, template.value)) {
          return perr.badValue(key + ': ' + template.value, template)
        }
        break
      case 'number':
      case 'boolean':
        if (template.value !== val) {
          return perr.badValue(key + ': ' + template.value, template)
        }
        break
      default:
        return perr.serverError('Invalid call to check, unsupported ' +
            'value type: ' + template.value, template)
    }
    return null // value success
  }

  return null // module success
}

module.exports = check
