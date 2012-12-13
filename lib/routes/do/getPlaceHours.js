/*
 * getPlaceHours
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

  if (!(req.body.sourceId && typeof req.body.sourceId === 'string')) {
    return res.error(proxErr.missingParam('sourceId type string'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.badValue('source'))
  }

  doPlaceHours(req, res)
}

function doPlaceHours(req, res) {

  if (req.body.source == 'foursquare') {
    var serviceUri = 'https://api.foursquare.com/v2/venues/' + req.body.sourceId + '/hours?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'

    sreq({ uri: serviceUri }, function(err, sres, body) {

      if (err) return res.error(err)

      var hours = body.response.hours

      res.send({
        data: hours,
        date: util.getTimeUTC(),
        count: 1,
        more: false
      })
    })  
  }
}
