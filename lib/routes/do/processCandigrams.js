/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var moveCandigrams = require('./moveCandigrams').run

/* Request body template start ========================================= */

var _body = {
  method:             { type: 'string', default: 'proximity' },  // proximity, range
  range:              { type: 'number' },                        // -1 = unlimited
  returnPlaces:       { type: 'boolean', default: false },
  toId:               { type: 'string' },                        // used primarily for testing
  skipNotifications:  { type: 'boolean' },
  skipActivityDate:   { type: 'boolean' },
  skipMove:           { type: 'boolean', default: false },
}

/* Request body template end ========================================= */

/* 
 * Public web service 
 */
module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var body = util.clone(req.body)
  run(req, body, function(err, places, errors, activityDate) {
    if (err) return res.error(err)

    places = places || []
    errors = errors || []

    var results = {
      data: places,
      date: activityDate,
      count: places.length,
      more: false
    }
    if (errors.length > 0) {
      results.error = errors[0]
    }
    res.send(results)      
  })
}

/* 
 * Internal method that can be called directly 
 */
var run = exports.run =  function(req, body, cb) {

  var err = util.check(body, _body)
  if (err) return done(err)

  var activityDate = util.now()
  var entityIds = []
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
    moveCandigrams(req, options, function(err, places, errors, activityDate) {
      done(err, places, errors, activityDate)
    })
  }

  function done(err, places, errors, activityDate) {
    if (err) log(err.stack || err)
    cb(err, places, errors, activityDate)
  }
}