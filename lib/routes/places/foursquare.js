/**
 * /routes/places/foursquare.js
 *
 */

var getCategory = require('./categories').getCategory

// Get places from foursquare
function get(req, cb) {

  var search = {
    path: 'search' || req.body.path,
    query: {
      ll: req.body.location.lat + ',' + req.body.location.lng,
      radius: req.body.radius,
      query: req.body.query, // for suggest
      limit: Math.min(50, req.body.limit + req.body.excludeCount)
    },
    timeout: req.body.timeout,
    log: req.body.log,
  }

  util.callService.foursquare(search, function(err, res, body) {

    if (err) return cb(perr.partnerError('foursquare', err))
    try { body.response.venues.length += 0 } catch(e) {
      logErr('Error: call to foursquare: ', search)
      logErr('Returned unexpected results:', res.text)
      return cb(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? res.body.response.venues
      : null

    body.response.venues.forEach(function(venue) {
      if (req.exclude(venue.id)) return

      // popularity filter
      if (!(venue.stats && venue.stats.checkinsCount && (venue.stats.checkinsCount > 10))) return

      // create a place object in the shape of one of our entities
      var place = {
        name: venue.name,
        schema: statics.schemaPlace,  // for use in munged entities array
        provider: {foursquare: venue.id}
      }


      // Set the contact
      if (venue.contact) {
        place.phone = venue.contact.phone
      }

      // Set the place
      if (venue.location) {
        place.location = {
          lat: venue.location.lat,
          lng: venue.location.lng,
        }
        place.address = venue.location.address
        place.postalCode = venue.location.postalCode
        place.city = venue.location.city
        place.region = venue.location.state
        place.country = venue.location.cc  || venue.location.country
      }

      // Set the place category
      var catId = null
      if (venue.categories && venue.categories.length) {
        catId = venue.categories[0].id  // default
        venue.categories.forEach(function(category) {
          if (category.primary) {
            catId = category.id
            return // forEach
          }
        })
        if (catId) place.category = getCategory(catId, 'foursquare')
      }

      places.push(place)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
