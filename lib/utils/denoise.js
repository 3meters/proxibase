/**
 * utils/denoise
 *
 *   Remove noise words from a string
 */

var _ = require('./')._
var noise = ['a', 'the', 'an', '.', ',', '!', ':', 'mr', 'mr.', 'ms', 'ms.']

module.exports = function(str) {
  str = String(str).toLowerCase().split(' ')
  return _.difference(str, noise).join(' ')
}
