/**
 * Synchronous parameter checker. Returns null on success or an
 * Error if the passsed-in object mismatches the passed-in template.
 * May modify the object, but does not modify the template.
 * Requires type.  Recurses for fields of type object.
 * Consider: optional types
 * Consider: asyncronous option
 */

var _ = require('underscore')
var assert = require('assert')
var util = require('./')
var type = util.type
var perr = util.perr

function check(template, object, options) {

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
      var err = check(template[key].value, object[key], options)
      if (err) return err
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

    // Check type
    if (template[key].type && !type.isUndefined(object[key]) &&
        (type(object[key]) !== template[key].type)) {
      assert(type(template[key].type) === 'string',
        'Invalid call to check. template.' + key + '.type must be a string')
      return perr.badType(key + ': ' + template[key].type, template)
    }

    // Check required value, can be a scalar, a pipe-separated string,
    // or a validator function
    if (template[key].value) {
      if (type.isFunction(template[key].value)) {
        // Call validator function. Validators return null on
        // success, an Error on failure. Perform cross-key
        // validation using optional params object and key
        var err = template[key].value(object[key], object, key)
        if (err) return perr.badValue(err, template)
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
        if (!found) return perr.badValue(key + ': ' + template[key].value, template)
      }
      else if (template[key].type !== 'object') {
        if (template[key].value !== object[key]) {
          log('template1', template[key].value)
          log('object1', object[key])
          return perr.badValue(key + ': ' + template[key].value, template)
        }
      }
    }
  }
  return null // success
}

module.exports = check
