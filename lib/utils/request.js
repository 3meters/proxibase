/**
 * proxutils/request.js
 *
 *    Our request wrapper
 */

var util = require('./')    // jshint ignore:line
var superagent = require('superagent')

function extend() {

  var Request = superagent.Request
  var _end = Request.prototype.end

  // Override super agent's end method to always try to parse request text
  // as json, (facebook sends json, but incorrectly sets the content-type
  // to text).  Like Mikeal's request module, we always provide req.body
  // as a convenience third param
  Request.prototype.end = function(cb) {
    _end.call(this, function(err, res) {
      if (err) return cb(err, res)
      if (res.text && util._.isEmpty(res.body)) {
        try { res.body = JSON.parse(res.text); res.json = true }
        catch (e) { res.json = false }
      }
      cb(null, res, res.body)
    })
  }
}

extend()
module.exports = superagent
