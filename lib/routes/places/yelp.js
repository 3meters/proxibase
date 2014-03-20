/**
 * /routes/places/yelp.js
 *
 */

var getCategory = require('./categories').getCategory

// Get places from yelp
function get(req, cb) {

  var search = req.body.search || {
    path: '/v2/search',
    query: {
      ll: req.body.location.lat + ',' + req.body.location.lng,
      radius_filter: req.body.radius,
      limit: Math.min(50, req.body.limit + req.body.excludeCount)
    },
    timeout: req.body.timeout,
    log: req.body.log,
  }

  util.callService.yelp(search, function(err, res, body) {
    if (err) return cb(perr.partnerError('yelp', err))

    var venues = body.businesses

    if (!tipe.isNumber(venues.length)) {
      logErr('Error: call to yelp: ', search)
      logErr('Returned unexpected results:', res.text)
      return cb(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? venues
      : null

    venues.forEach(function(venue) {
      if (req.exclude(venue.id)) return

      // popularity filter
      if (!venue.review_count > 10) return
      if (venue.is_closed) return

      // create a place object in the shape of one of our entities
      var place = {
        name: venue.name,
        schema: statics.schemaPlace,  // for use in munged entities array
        provider: {yelp: venue.id},
        phone: venue.phone,
      }

      // picture
      if (venue.image_url) place.picture = {
        source: 'yelp',
        prefix: venue.image_url,
      }

      // Set the place
      if (venue.region) {
        place.location = {
          lat: venue.region.center.latitude,
          lng: venue.region.center.longitude,
        }
      }
      if (venue.location) {
        place.address = venue.location.address
        place.postalCode = venue.location.postalCode
        place.city = venue.location.city
        place.region = venue.location.state
        place.country = venue.location.country_code
      }

      // Set the place category return is [['Cat Name2', 'catid1'], ['Cat Name2', 'catid1']
      if (venue.categories && venue.categories.length) {
        place.category = getCategory(venues.categories[0][1], 'yelp')
      }

      places.push(place)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
