/**
 * proxutils/request.js
 *
 *    Our request wrapper
 */

var util = require('./')
var superagent = require('superagent')

function extend() {

  var Request = superagent.Request
  var _end = Request.prototype.end

  // Override super agent's end method to always
  // try to parse the request text as json, and to
  // always provide body as a convenience third param
  Request.prototype.end = function(cb) {
    _end.call(this, function(err, res) {
      if (err) return cb(err, res)
      res.json = true
      if (util._.isEmpty(res.body)) {
        try { res.body = JSON.parse(res.text) }
        catch (e) { res.json = false }
      }
      cb(null, res, res.body)
    })
  }
}

extend()
module.exports = superagent
