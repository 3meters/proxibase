/*
 * util/timer
 *
 *   Simple timer. Returns a constructor:
 *
 *       var timer = require('./timer').start()
 */

function Timer() {
  this._startTime = null
  this.start()  // newing a timer starts it implicitly
  return this
}

// Start
Timer.prototype.start = function() {
  this._startTime = Date.now()
}

// Base: return the number of seconds between 1/1/1970 and the start time
Timer.prototype.base = function() {
  return this._startTime/1000
}

// BaseDate: return the start time as a Date object
Timer.prototype.baseDate = function() {
  return new Date(this._startTime)
}

// Read the miliseconds elapsed since startTime and keep timing
Timer.prototype.read = function() {
  return (Date.now() - this._startTime)
}

module.exports = function() {
  return new Timer()
}
