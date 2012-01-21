/*
 * local utils (not to be confused with Node's util)
 */

var util = require('util');

exports.inspect = function(msg, obj, level) {
  var out = '';
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
    level = level || 3;
    out = msg + "\n" + util.inspect(obj, false, level);
    }
  } else if (typeof msg === 'object') { // no message, just an object and optional level
    level = obj || 3;
    out = util.inspect(msg, false, level);
  } else throw new Error("Could not parse params to inspect");
  console.log(out);
}
