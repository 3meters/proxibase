/**
 * /routes/places/google.js
 *
 *   Get places from google
 */

function get(req, cb) {

  var iconPath = '/img/categories/google/'
  var search = {
    path: 'nearbysearch/json',
    query: {
      location: req.body.latitude + ',' + req.body.longitude,
      radius: req.body.radius,
      sensor: true,
    },
    log: true
  }

  util.callService.google(search, function(err, res) {
    if (err) return finish(err)
    if (!res.body.results) {
      logErr(perr.partnerError('google', {
        status: res.status,
        query: search,
        result: res.text,
      }))
      return cb(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? res.body.results
      : null

    res.body.results.forEach(function(venue) {
      if (req.exclude(venue.reference)) return

      // create a place object in the shape of one of our entities
      var googlePlace = {
        name: venue.name,
        place: {
          provider: {google: venue.reference}, // not venue.id
        },
        sources: [{
          type: 'google',
          id: venue.reference,
          name: venue.name || undefined,
          data: {origin: 'google', originId: venue.reference},
        }],
      }

      // The only address info in Google's nearby query is lat,lng
      if (venue.geometry.location) {
        googlePlace.place.location = {
          lat: venue.geometry.location.lat,
          lng: venue.geometry.location.lng,
        }
      }

      // Google uses an array of names without ids, pick the first
      if (venue.types) {
        googlePlace.place.category = {
          id: venue.types[0],
          name: venue.types[0],
        }
      }

      places.push(googlePlace)
    })

    cb(null, places, raw)
  })
}

module.exports = get
