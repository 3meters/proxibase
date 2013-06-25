/**
 * utils/chk
 *
 * Wrapper around chk module to map its generic error
 * codes to our corresponding proxerr codes and http 
 * status codes
 */

var chk = require('chk')
var proxErr = require('./error')

module.exports = function(value, schema, options) {
  var err = chk(value, schema, options)
  if (err && err.code && proxErr.errMap[err.code]) {
    err.code = proxErr.errMap[err.code].code  // badType => 400.12
    err.status = parseInt(err.code)           // http statusCode 400
  }
  return err
}
