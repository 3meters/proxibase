/**
 * utils/merge.js
 *
 *  EXPIRIMENTAL
 *
 *  needed when
 *
 *     undefined != null
 *
 *  matters
 *
 *  Like _.extend but filters out enumerable
 *  properties whoes values are undefined.
 *
 *  Needed because our prameter-passing pattern
 *  often enumerates properties which need to
 *  be overridden downstream.
 *
 *  TODO: provide examples
 */

module.exports = function(o1, o2) {
  if (!o2) return o1
  for (var prop in o2) {
    if (typeof(o2[prop]) !== 'undefined') {
      o1[prop] = o2[prop]
    }
  }
  return o1
}
