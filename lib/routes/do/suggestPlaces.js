/*
 * do/suggestPlaces
 *
 * Deprecated:  use /places/suggest
 *
 */


var suggest = require('../places/suggest')

exports.main = function(req, res) {
  req.deprecated = '/places/suggest'
  suggest.main(req, res)
}
