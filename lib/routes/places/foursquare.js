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
      var entity = {
        name: venue.name,
        sources: [{
          type: 'foursquare',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'foursquare', originId: venue.id},
        }],
      }

      var place = {
        provider: {foursquare: venue.id}
      }
      // Set the contact
      if (venue.contact) {
        place.phone = venue.contact.phone
        place.formattedPhone = venue.contact.formattedPhone
      }

      // Set the place
      if (venue.location) {
        place.lat =        venue.location.lat
        place.lng =        venue.location.lng
        place.address =    venue.location.address
        place.postalCode = venue.location.postalCode
        place.city =       venue.location.city
        place.state =      venue.location.state
        place.cc =         venue.location.cc
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

      entity.place = place

      // Set the sources
      if (venue.url) {
        entity.sources.push({
          type: 'website',
          id: venue.url,
          name: venue.url,
          data: {origin:'foursquare', originId: venue.id}
        })
      }

      if (venue.contact && venue.contact.twitter) {
        entity.sources.push({
          type:'twitter',
          id: venue.contact.twitter,
          data: {origin:'foursquare', originId: venue.id},
        })
      }

      places.push(entity)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
