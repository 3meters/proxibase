/**
 * routes/do/countLinks.js
 *
 *    deprecated:  use /stats/to and /stats/from
 */

var stats = require('../stats')

exports.to = function(req, res) {
  req.deprecated = true
  stats.to(req, res)
}

exports.from = function(req, res) {
  req.deprecated = true
  stats.from(req, res)
}

exports.to.anonOk = true
exports.from.anonOk = true
