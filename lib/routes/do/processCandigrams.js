/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var moveCandigrams = require('./moveCandigrams').run

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    method:             { type: 'string', default: 'proximity' },  // proximity, range
    toId:               { type: 'string' },                        // used primarily for testing
    range:              { type: 'number' },                        // used primarily for testing
    skipNotifications:  { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
    returnPlaceIdsOnly: { type: 'boolean', default: true },
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var entityIds = []
  var activityDate = util.getTimeUTC()
  var options = util.clone(req.body)

  doProcessCandigrams()

  function doProcessCandigrams() {
    log('doProcessCandigrams')

    var query = {
      enabled: true,
      type: 'tour',
      hopNextDate: { $gte: activityDate },
    }

    db.candigrams
      .find(query, { _id: 1 })
      .toArray(function(err, docs) {
        if (err) return res.error(err)
        if (!docs || docs.length == 0) return done()

        for (var i = docs.length; i--;) {
          entityIds.push(docs[i]._id)
        }        
        moveCandigrams()
    })
  }

  function moveCandigrams() {
    options.entityIds = entityIds
    moveCandigrams(req, options, function(err, places, errors) {
        if (err) return res.error(err)
        done(places, errors)
    })
  }

  function done(places, errors) {
    res.send({
      data: places,
      errors: errors,
      date: util.now(),
      count: places.length,
    })
  }
}
