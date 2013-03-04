/**
 * utils/clone.js
 *
 *   Deep clone using JSON stringify round trip.  Returns null on failure.
 *   Object including circular references will fail.
 *
 *   Underscore's clone is shallow, leaving subobjects and arrays referenced.
 */

module.exports = function(o) {
  try { return JSON.parse(JSON.stringify(o)) }
  catch (e) { return null }
}

