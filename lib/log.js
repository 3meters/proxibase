/*
 * My logger.  Setting stdErr will send the output console.error, which is syncronous IO, 
 *   and may alter the execution logic of the program, but will always give you output
 *   Doesn't correctly handle string substution -- use console.log for that
 */

var util = require('util');

module.exports = function(msg, obj, level, stdErr) {
  stdErr = stdErr || false;  // must use all four params to get to report to stdErr
  var out = '';
  if (typeof msg === 'string') {
    // if (msg.indexOf('%') >= 0) // asking for string substitution, hand off to console.log
    //   return console.log([].join.apply(arguments)); // aguments isn't a real array, steal a method
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
  if (stdErr)
    console.error(out);
  else
    console.log(out);
  return;
}

