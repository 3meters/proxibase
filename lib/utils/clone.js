/**
 * utils/clone.js
 *
 *   Deep clone using JSON stringify round trip.  Returns an error on failure,
 *   rather than throwing. Objects including circular references will fail.
 *
 *   Underscore's clone is shallow, leaving subobjects and arrays referenced.
 *
 *   This will not work for javascript Dates and regular expression litterals.
 */

module.exports = function(o) {
  try { return JSON.parse(JSON.stringify(o)) }
  catch (e) { return e }
}

