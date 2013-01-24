/*
 * getPlaceCategories
 */

var util = require('util')
var log = util.log

// Request body template
var _body = {
}

exports.main = function(req, res) {

  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)

  if (req.body.source == 'foursquare') {

    util.callService.foursquare('categories', function(err, sres) {
      if (err) return res.error(err)

      var categories = sres.body.response.categories
      res.send({
        data: categories,
        date: util.getTime(),
        count: categories.length,
        more: false
      })
    })
  }
}
