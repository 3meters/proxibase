/*
 * getPlaceCategories
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , log = util.log
  , sreq = util.request // service request (non-aircandi)

exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.error(proxErr.missingParam('source type string'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.badValue('source'))
  }

  doPlaceCategories(req, res)
}

function doPlaceCategories(req, res) {

  if (req.body.source == 'foursquare') {
    var serviceUri = 'https://api.foursquare.com/v2/venues/categories?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'

    sreq({ uri: serviceUri, method: 'get' }, function(err, sres, body) {

      if (err) return res.error(err)

      var categories = body.response.categories

      res.send({
        data: categories,
        date: util.getTimeUTC(),
        count: categories.length,
        more: false
      })
    })  
  }
}
