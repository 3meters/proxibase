/**
 * /routes/places/foursquare.js
 *
 */

var _sources = util.statics.sources


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
      var fourPlace = {
        name: venue.name,
        place: {
          provider: {foursquare: venue.id}
        },
        sources: [{
          type: 'foursquare',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'foursquare', originId: venue.id},
        }],
      }

      // Set the contact
      if (venue.contact) {
        fourPlace.place.contact = {
          phone: venue.contact.phone,
          formattedPhone: venue.contact.formattedPhone,
        }
      }

      // Set the location
      if (venue.location) {
        fourPlace.place.location = {
          address:      venue.location.address,
          postalCode:   venue.location.postalCode,
          city:         venue.location.city,
          state:        venue.location.state,
          country:      venue.location.country,
          cc:           venue.location.cc,
          lat:          venue.location.lat,
          lng:          venue.location.lng,
        }
      }

      // Set the place category
      if (venue.categories) {
        venue.categories.forEach(function(category) {
          if (category.primary) {
            fourPlace.place.category = {
              id: category.id,
              name: category.name,
            }
            return
          }
        })
      }

      // Set the sources
      if (venue.url) {
        fourPlace.sources.push({
          type: 'website',
          id: venue.url,
          name: venue.url,
          data: {origin:'foursquare', originId: venue.id}
        })
      }

      if (venue.contact && venue.contact.twitter) {
        fourPlace.sources.push({
          type:'twitter',
          id: venue.contact.twitter,
          data: {origin:'foursquare', originId: venue.id},
        })
      }

      places.push(fourPlace)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
