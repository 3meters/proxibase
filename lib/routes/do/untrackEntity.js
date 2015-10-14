/*
 * Untrack entity: thin public wrapper over private track api
 */

var trackEnt = require('./trackEntity').run

exports.main = function(req, res) {
  trackEnt('untrack', req, res)
}
