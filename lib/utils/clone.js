/**
 * utils/clone
 *
 *   Alias for lodash.clone
 */

var underscore = require('./')._

module.exports = function(o) {
  return underscore.clone(o)
}
