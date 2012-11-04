/*
 * getPlaceTips
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

  if (req.body.limit && typeof req.body.limit !== 'number') {
    return res.error(proxErr.badValue('limit type number'))
  }

  if (req.body.skip && typeof req.body.skip !== 'number') {
    return res.error(proxErr.badValue('skip type number'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.badValue('source'))
  }

  doPlaceTips(req, res)
}

function doPlaceTips(req, res) {

  if (req.body.source == 'foursquare') {
    var limit = req.body.limit ? req.body.limit : 30
    var skip = req.body.skip ? req.body.skip : 0
    var serviceUri = 'https://api.foursquare.com/v2/venues/' + req.body.sourceId + '/tips?sort=popular&client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
    serviceUri += '&limit=' + limit + '&offset=' + skip

    sreq({ uri: serviceUri, method: 'get' }, function(err, sres, body) {

      if (err) return res.error(err)

      var tips = body.response.tips.items

      /* 
       * foursquare provides dates with precision to the second so
       * we normalize to millisecond precision.
       */
      if (tips) {
        for (var i = 0; i < tips.length; i++) {
          tips[i].createdAt *= 1000
        }
      }

      var more = (tips.length < body.response.tips.count)

      res.send({
        data: tips,
        date: util.getTimeUTC(),
        count: tips.length,
        more: more
      })
    })  
  }
}
