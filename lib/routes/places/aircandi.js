/**
 * /routes/places/aircandi.js
 *
 *    Aircandi native place provider
 */

var categories = require('./categories')
var getEntities = require('../do/getEntities').run

function get(req, cb) {

  // Build our query to find our entities within the circle
  var radians = req.body.radius / 6378137  // radius of the earth in meters
  var query = {
    "location.geometry": {
      $within: {$centerSphere:
       [[req.body.location.lng, req.body.location.lat], radians]}
    }
  }
  // Near queries sort by distance
  query = {
    'location.geometry': {
      $near: [req.body.location.lng, req.body.location.lat],
      $maxDistance: radians,
    }
  }

  // Find the _ids first, then call getEntities to build the playload
  util.db.places
    .find(query, {'_id': 1})
    .limit(req.body.limit)
    .toArray(function(err, entIds) {
      if (err) return cb(err)

      // Convert [{_id: <_id1>},{_id: <_id2>}] to [<_id1>,<_id2>]
      for (var i = entIds.length; i--;) {
        entIds[i] = entIds[i]._id
      }

      if (!entIds.length) return cb(null, [])

      getEntities(req, {entityIds: entIds, links: req.body.links}, cb)
    })
}

exports.get = get
