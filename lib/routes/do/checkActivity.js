/**
 * checkActivity
 * 
 * Fast check for staleness
 */

var db = util.db
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:       { type: 'string', required: true },
    activityDate:   { type: 'number', required: true },
  }

  /* Request body template end ========================================= */  

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var entityId = req.body.entityId
  var entityIdParsed = util.parseId(entityId)

  db[entityIdParsed.collectionName].findOne({ _id: entityId }, { activityDate: 1 }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(perr.notFound())

    var stale = (doc.activityDate > req.body.activityDate)
    log('stale: ' + stale)
    res.send({
      info: stale ? 'entity is stale' : 'entity is current',
      date: util.now(),
      count: 0,
      data: [],
    })
  })
}
