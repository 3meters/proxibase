/*
 * local utils (not to be confused with Node's util)
 */

var util = require('util');

var inspect = exports.inspect = function(msg, obj, level) {
  var out = '';
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
      level = level || 3;
      out = msg + "\n" + util.inspect(obj, false, level);
    }
  } else { 
    // no message, just an object and optional level, shift params left
    level = obj || 3;
    out = util.inspect(msg, false, level);
  }
  console.log(out);
}


// Experimental:  convert the monogodb driver's objectID to a more compact representation
exports.tinyize = function(objecId, alpahbet) {
  objectId = objectId || new mongoose.Types.ObjectId();
  alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  var num = parseInt(objectId, 16);  // broken: this looses precision, leading to collisions
  inspect(objectId);
  inspect(num.toString(16));
  var radix = alphabet.length;
  var tinyId = '';
  while (num > 0) {
    var remainder = num % radix;
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix;
  }
  return tinyId;
}



