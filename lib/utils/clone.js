/**
 * utils/clone.js
 *
 *   Deep clone using JSON stringify round trip.
 *
 *   Underscore's clone is shallow, leaving subobjects and arrays referenced.
 *
 *   This will blow up on objects with circular references, such as node's http
 *   and res objects, so either use with great care or wrap in try-catch as with
 *   any call to JSON
 */

module.exports = function(o) {
  return JSON.parse(JSON.stringify(o))
}

