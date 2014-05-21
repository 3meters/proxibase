/*
 * do/suggestPlaces
 *
 * Deprecated:  use /places/suggest
 *
 */


var suggest = require('../places/suggest')

exports.main = function(req, res) {
  req.depricated = req.depricated || ''
  req.depricated += '/places/suggest'
  suggest.main(req, res)
}
