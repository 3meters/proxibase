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

  util.callService.google(search, function(err, sres) {
    if (err) return finish(err)
    if (!sres.body.results) {
      logErr(perr.partnerError('google status: ' + sres.status, sres.text))
      return cb(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? sres.body.results
      : null

    sres.body.results.forEach(function(venue) {
      if (req.exclude(venue.id)) return

      // create a place object in the shape of one of our entities
      var googlePlace = {
        name: venue.name,
        place: {
          provider: {google: venue.reference}, // not venue.id
        },
        sources: [{
          type: 'google',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'google', originId: venue.id},
        }],
      }

      if (venue.geometry.location) {
        googlePlace.place.location = {
          lat: venue.geometry.location.lat,
          lng: venue.geometry.location.lng,
        }
      }

      places.push(googlePlace)
    })

    cb(null, places, raw)
  })
}

module.exports = get
