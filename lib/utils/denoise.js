/**
 * utils/denoise
 *
 *   Remove noise words from a string
 */

var underscore = require('./')._
var noise = ['a', 'the', 'an', '.', ',', '!', ':', 'mr', 'mr.', 'ms', 'ms.']

module.exports = function(str) {
  str = String(str).toLowerCase().split(' ')
  return underscore.difference(str, noise).join(' ')
}
