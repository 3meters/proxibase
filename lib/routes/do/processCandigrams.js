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
    range:              { type: 'number' },                        // -1 = unlimited
    returnPlaces:       { type: 'boolean', default: false },
    toId:               { type: 'string' },                        // used primarily for testing
    skipNotifications:  { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var entityIds = []
  var activityDate = util.getTimeUTC()
  var options = util.clone(req.body)
  var places = []
  var errors = []

  var query = {
    type: 'tour',
    hopEnabled: true,
    hopNextDate: { $lte: activityDate },
    enabled: true,
  }

  db.candigrams
    .find(query, { _id: 1 })
    .toArray(function(err, docs) {
      if (err) return res.error(err)
      if (!docs || docs.length == 0) {
        log('no candigrams ready to move')
        return done()
      }

      for (var i = docs.length; i--;) {
        entityIds.push(docs[i]._id)
      }        
      move()
  })

  function move() {
    options.entityIds = entityIds
    log('found ' + entityIds.length + ' candigram(s) to move')
    moveCandigrams(req, options, function(err, places, errors) {
      done(err, places, errors)
    })
  }

  function done(err, places, errors) {
    if (err) return res.error(err)
    places = places || []
    errors = errors || []
    res.send({
      data: places,
      errors: errors,
      date: util.now(),
      count: places.length,
    })      
  }
}