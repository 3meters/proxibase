/**
 * utils/chek
 *
 * Wrapper around chek module to map its generic error
 * codes to our corresponding http-friendly error codes
 */

var chek = require('chek')
var proxErr = require('./error')

module.exports = function(value, schema, options) {
  var err = chek(value, schema, options)
  if (err.code && proxErr.errMap[err.code]) {
    err.code = proxErr.errMap[err.code].code
  }
  return err
}
