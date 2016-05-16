/**
 * utils/scrub
 *
 * Wrapper around scrub module to map its error
 * codes to our corresponding perr codes
 */

var scrubMod = require('scrub')
var proxError = require('./error')

module.exports = function(value, spec, options) {
  var err = scrubMod(value, spec, options)

  if (err) {
    if (!err.code) err.code = 500  // Unknown, map to generic server error
    if (_.isString(err.code) && proxError.errMap[err.code]) {
      err.code = proxError.errMap[err.code].code  // badType => 400.12
    }
    if (!_.isNumber(err.code)) err.code = 500
    err.status = parseInt(err.code)        // http statusCode 400
  }
  return err
}
