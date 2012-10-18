/*
 * extend/javascript.js
 *
 *  extend javascript core
 */

var async = require('async')  // https://github.com/caolan/async

// Extend Array -- note that we use the serial, not parallel iterator
Array.prototype.forEachAsync = function(iterator, callback) {
  return async.forEachSeries(this, iterator, callback)
}


