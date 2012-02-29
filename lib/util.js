var util = require('util')

/*
 * My logger.  log sends output to stdout async.  logErr sends to stderr synchronously,
 *   which alters the execution logic of the program, but will always give you output
 *   TODO: correctly handle string substution -- use console.log for that for now
 */

var log = module.exports.log = function(msg, obj, showHidden, level) {
  console.log(formatErr(msg, obj, showHidden, level))
}

var logErr = module.exports.logErr = function(msg, obj, showHidden, level) {
  console.error(formatErr(msg, obj, showHidden, level))
}

function formatErr(msg, obj, showHidden, level) {
  var out = ''
  if (typeof msg === 'string') {
    // if (msg.indexOf('%') >= 0) // asking for string substitution, hand off to console.log
    //   return console.log([].join.apply(arguments)) // aguments isn't a real array, steal a method
    if (!obj) out = msg
    else {
      showHidden = showHidden || false
      level = level || 3
      out = msg + "\n" + util.inspect(obj, showHidden, level)
    }
  } else { 
    // no message, just an object, shift params left
    level = showHidden || 3
    showHidden = obj || false
    obj = msg
    out = util.inspect(obj, showHidden, level)
  }
  return out
}

/*
 * Send a nicely formatted error to a client that expects JSON
 * TODO:  This might be more elegently implemented by extending connect's res object with
 *        with a custom res.err(err) method
 */
module.exports.sendErr = function(res, err, statusCode) {
  statusCode = parseInt(statusCode) || 400
  var body = {}
  body.name = 'Error'
  body.error = 'Unexpected error message. Call for help.'
  if (typeof err === 'number') {
    statusCode = err
    if (err === 400) body.error = "Bad request"
    if (err === 404) body.error = "Not found"
    if (err === 500) body.error = "Unexpected server error"
  } else if (typeof err === 'string') {
    body.error = err
  } else if (err instanceof Error) {
    if (err.name) body.name = err.name
    if (err.message) body.error = err.message
    if (err.code) body.code = err.code
    if (err.errors) body.errors = err.errors
  }
  res.send(body, statusCode)
}


// Experimental:  convert the monogodb driver's ObjectId to a more compact representation
function tiny(oid, alphabet) {
  var oid = oid || new mongoose.Types.ObjectId()
  var alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  var tinyId = ''
  var num = parseInt(oid, 16)  // broken: this looses precision, leading to collisions
  log(oid)
  log(num.toString(16))
  var radix = alphabet.length
  while (num > 0) {
    var remainder = num % radix
    tinyId = alphabet.charAt(remainder) + tinyId // build up string from right to left
    num = (num - remainder) / radix
  }
  return tinyId
}


