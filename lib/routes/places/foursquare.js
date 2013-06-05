/**
 * /routes/places/foursquare.js
 *
 */


// Get places from foursquare
function get(req, cb) {

  var search = {
    path: 'search',
    query: {
      ll: req.body.latitude + ',' + req.body.longitude,
      radius: req.body.radius,
      limit: Math.min(50, req.body.limit + req.body.excludeCount)
    },
    log: true,
  }

  util.callService.foursquare(search, function(err, res, body) {

    if (err) return res.error(perr.partnerError('foursquare', err))
    try {var l = body.response.venues.length} catch(e) {
      logErr('Error: call to foursquare: ', search)
      logErr('Returned unexpected results:', res.text)
      return finish(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? res.body.response.venues
      : null

    body.response.venues.forEach(function(venue) {
      if (req.exclude(venue.id)) return

      // create a place object in the shape of one of our entities
      var place = {
        name: venue.name,
        schema: util.statics.typePlace,  // for use in munged entities array
        provider: {foursquare: venue.id}
      }


      // Set the contact
      if (venue.contact) {
        place.phone = venue.contact.phone
        place.formattedPhone = venue.contact.formattedPhone
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
        place.state = venue.location.state
        place.cc = venue.location.cc
      }

      // Set the place category
      if (venue.categories) {
        venue.categories.forEach(function(category) {
          if (category.primary) {
            place.category = {
              id: category.id,
              name: category.name,
            }
            return
          }
        })
      }

      places.push(place)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
