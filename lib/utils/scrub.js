/**
 * utils/scrub
 *
 * Wrapper around scrub module to map its error
 * codes to our corresponding perr codes
 */

var scrub = require('scrub')
var perr = require('./error')

module.exports = function(value, spec, options) {
  var err = scrub(value, spec, options)
  if (err && err.code && perr.errMap[err.code]) {
    err.code = perr.errMap[err.code].code  // badType => 400.12
    err.status = parseInt(err.code)        // http statusCode 400
  }
  return err
}
