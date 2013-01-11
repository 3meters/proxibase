/**
 * extend/util/checkParams.js
 *
 * Parameter checker.  Returns null on success or a proxErr if the
 * passsed-in object does not match the passed-in object template.
 * Can modify the object, but does not modify the template.
 * Shallow check only for now.
 */

var type = require('util').type
var _ = require('underscore')
var assert = require('assert')

module.exports = function(template, object) {

  if (type(object) !== 'object') {
    return perr.badType('object')
  }

  // Pass in an empty object to get back quick api docs
  if (_.isEmpty(object)) {
    return perr.missingParam(null, template)
  }

  for (key in template) {

    // Check required
    if (template[key].required &&
        ((type(object[key]) === 'undefined') ||
         (type(object[key]) === 'null'))) {
      return perr.missingParam(key)
    }

    // Set defaults
    if (template[key].default && type(object[key]) === 'undefined') {
      object[key] = template[key].default
    }

    // Check type
    if (template[key].type && (type(object[key]) !== 'undefined') &&
        (type(object[key]) !== template[key].type)) {
      assert(type(template[key].type) === 'string',
          'Invalid call to checkParams, template.' + key + '.type must be of type string')
      return perr.badType(key + ': ' + template[key].type)
    }

    // Check required value, can be a simple scalar or a validator function
    if (template[key].value) {
      if (type(template[key].value === 'function')) {
        // Call validator function.  Function should return null on success
        // or an error message on failure.  Can perform cross-key validation
        // using optional params object and key
        var err = template[key].value(object[key], object, key)
        if (err) return perr.badValue(err)
      }
      else {
        // Only scalar values now, can add values of type object if needed
        if (template[key] !== object[key]) {
          return perr.badValue(key + ': ' + template[key].value)
        }
      }
    }
  }
  return null // success
}

