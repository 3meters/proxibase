/*
 * Util Timer
 *   returns a constructor
 *   var Timer = require('util/timer').Timer
 */
exports.Timer = function() {

  var
    startTime = null
    offset = new Date(2010, 0, 1).getTime()  // 40 years from Javascript Date begin

  // Make sure caller uses new
  if (!(this instanceof arguments.callee)) {
    throw new Error('util.Timer must be called as a constructor:  e.g. mytimer = new util.Timer()')
  }

  // Offset -- seconds between 1/1/1970 and 1/1/2010
  this.offset = function () {
    return offset/1000
  }

  // Start
  this.start = function() {
    startTime = new Date().getTime() - offset
  }

  // Base: return the number of seconds between 1/1/2010 and the start time
  this.base = function() {
    return startTime/1000
  }

  // Read and keep timing
  var read = this.read = function() {
    return (new Date().getTime() - offset - startTime) / 1000
  }

  this.start()  // newing a timer starts it implicitly
}



