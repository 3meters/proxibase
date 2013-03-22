/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in template.
 * May modify the object, but does not modify the template.
 * Requires type.  Recurses for fields of type object.
 * Consider: optional types
 * Consider: asyncronous option
 */

var _ = require('underscore')
var util = require('./')
var type = util.type
var perr = util.perr

function check(object, template, options) {

  options = options || {
    strict: false,
    allowEmpty: false
  }

  if (!type.isObject(object)) {
    return perr.badType(object, template)
  }

  // If the method doesn't accept empty, pass in empty to get a quick api doc
  if (!_.isEmpty(template) && _.isEmpty(object) && !options.allowEmpty) {
    return perr.missingParam(null, template)
  }

  // Option.strict will error on unrecognized keys
  if (options.strict) {
    for (var key in object) {
      if (!template[key]) return perr.badParam(key, template)
    }
  }

  for (var key in template) {

    if (type.isObject(template[key].value)) { // recurse
      var err = check(object[key], template[key].value, options)
      if (err) return err
      continue
    }

    // Check required
    if (template[key].required &&
        (type.isUndefined(object[key]) || type.isNull(object[key]))) {
      return perr.missingParam(key, template)
    }

    // Set defaults
    if (template[key].default && type.isUndefined(object[key])) {
      object[key] = template[key].default
    }

    // Soft assert on the template
    if (template[key].type && !type.isString(template[key].type)) {
      var msg = 'Invalid call to check. template.' + key +
          '.type must be a string'
      return perr.serverError(msg, template)
    }

    // Check type:  TODO: support pipe-delimited multi-types
    if (template[key].type && !type.isUndefined(object[key]) &&
        (type(object[key]) !== template[key].type)) {
      return perr.badType(key + ': ' + template[key].type, template)
    }

    // Check value: value can be a scalar, a pipe-separated string,
    // or a validator function. TODO: arrays
    switch (type(template[key].value)) {
      case 'undefined':
        break
      case 'function':
        // Call validator function. Validators return null on
        // success, an Error on failure. Perform cross-key
        // validation using optional params object and key
        var err = template[key].value(object[key], object, key)
        if (err) return err
        break
      case 'string':
        // Multiple string values can be separated by |
        if (template[key].value.indexOf('|') >= 0) {
          var legalVals = template[key].value.split('|')
          var found = legalVals.some(function(val) {
            return (object[key] === val)
          })
          if (!found) return perr.badValue(key + ': ' +
              template[key].value, template)
          break // simple strings fall through
        }
      case 'number':
      case 'boolean':
        if (template[key].value !== object[key]) {
          return perr.badValue(key + ': ' + template[key].value, template)
        }
        break
      default:
        return perr.serverError('Invalid call to check, unsupported ' +
            'value type: ' + template[key].value, template)
    }
  }
  return null // success
}

module.exports = check
