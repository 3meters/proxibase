/**
 * /routes/places/factual.js
 *
 *   Get places from factual
 */

var getCategory = require('./categories').getCategory

function get(req, cb) {

  var search = {
    path: '/t/places-v3',
    query: {
      geo: {
        $circle: {
          $center: [req.body.location.lat, req.body.location.lng],
          $meters: req.body.radius,
        }
      },
      limit: req.body.limit,
    },
    timeout: req.body.timeout,
    log: req.body.log,
  }

  util.callService.factual(search, function(err, sres, body) {
    if (err) return cb(err)

    var places = []
    var raw = (req.body.includeRaw)
      ? body.data
      : null

    body.data.forEach(function(venue) {  // using foursquare's term venue for readability
      if (!(venue.category_ids && venue.category_ids.length)) return

      var place = {
        name: venue.name,
        location: {
          lat: venue.latitude,
          lng: venue.longitude,
        },
        address: venue.address,
        city: venue.locality,
        region: venue.region,
        postalCode: venue.postcode,
        country: venue.country,
        provider: {
          factual: venue.factual_id
        },
      }

      if (venue.tel) {
        place.phone = venue.tel.replace(/[^0-9]/g, '')  // strip non-numeric chars
      }

      if (venue.category_ids) {
        // factual only has one now, but claim that will change
        var catId = String(venue.category_ids[0])
        place.category = getCategory(catId, 'factual')
      }

      places.push(place)
    })

    cb(null, places, raw)
  })
}

module.exports = get
