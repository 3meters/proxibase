/**
 * Parameter checker.  Returns null on success or a proxErr if the
 * passsed-in object does not match the passed-in object template.
 * Can modify the object, but does not modify the template.
 * Shallow check only for now.
 */

var _ = require('underscore')
var assert = require('assert')
var util = require('./')
var type = util.type

function check(template, object, options) {

  options = options || {
    strict: false,
    allowEmpty: false
  }

  if (!type.isObject(object)) {
    return perr.badType(object)
  }

  // Pass in an empty object to get back quick api docs
  if (!_.isEmpty(template) && _.isEmpty(object) && !options.allowEmpty) {
    return perr.missingParam(null, template)
  }

  // option.strict will error on unrecognized keys
  if (options.strict) {
    for (var key in object) {
      if (!template[key]) return perr.badParam(key)
    }
  }

  for (var key in template) {

    // Check required
    if (template[key].required &&
        (type.isUndefined(object[key]) || type.isNull(object[key]))) {
      return perr.missingParam(key)
    }

    // Set defaults
    if (template[key].default && type.isUndefined(object[key])) {
      object[key] = template[key].default
    }

    // Check type
    if (template[key].type && !type.isUndefined(object[key]) &&
        (type(object[key]) !== template[key].type)) {
      assert(type(template[key].type) === 'string',
          'Invalid call to check, template.' + key + '.type must be of type string')
      return perr.badType(key + ': ' + template[key].type)
    }

    // Check required value, can be a simple scalar, a pipe-separated string, or a validator function
    if (template[key].value) {
      if (type.isFunction(template[key].value)) {
        // Call validator function.  Function should return null on success
        // or an error message on failure.  Can perform cross-key validation
        // using optional params object and key
        var err = template[key].value(object[key], object, key)
        if (err) return perr.badValue(err)
      }
      // Multiple string values can be separated by |
      else if (template[key].type === 'string' &&
          type.isString(template[key].value)  &&
          template[key].value.indexOf('|') >= 0 &&
          type.isString(object[key])) {
        var legalVals = template[key].value.split('|')
        var found = legalVals.some(function(val) {
          return (object[key] === val)
        })
        if (!found) return perr.badValue(key + ': ' + template[key].value)
      }
      else {
        // Won't work for type object, consider recursing or doing a _.deepEquals
        if (template[key].value !== object[key]) {
          return perr.badValue(key + ': ' + template[key].value)
        }
      }
    }
  }
  return null // success
}

module.exports = check
