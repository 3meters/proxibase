/**
 * routes/do/countLinks.js
 *
 *    deprecated:  use /stats/to/messages and /stats/from/users  etc
 */

var stats = require('../stats')

exports.to = function(req, res) {
  req.deprecated = req.deprecated || ''
  req.deprecated += '/stats/to'
  req.collection = db.safeCollection('tos')
  stats.to(req, res)
}

exports.from = function(req, res) {
  req.deprecated = req.deprecated || ''
  req.deprecated += '/stats/from'
  req.collection = db.safeCollection('froms')
  stats.from(req, res)
}

exports.to.anonOk = true
exports.from.anonOk = true
