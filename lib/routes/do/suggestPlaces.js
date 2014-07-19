/*
 * do/suggestPlaces
 *
 * Deprecated:  use /places/suggest
 *
 */


var suggest = require('../suggest')

exports.main = function(req, res) {
  req.depricated = req.depricated || ''
  req.depricated += '/places/suggest'
  suggest.main(req, res)
}
