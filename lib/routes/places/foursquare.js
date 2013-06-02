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
        type: util.statics.typePlace,
        sources: [{
          type: 'foursquare',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'foursquare', originId: venue.id},
        }],
      }

      entity.provider = {foursquare: venue.id}

      // Set the contact
      if (venue.contact) {
        entity.phone = venue.contact.phone
        entity.formattedPhone = venue.contact.formattedPhone
      }

      // Set the place
      if (venue.location) {
        entity.location = {
          lat: venue.location.lat,
          lng: venue.location.lng,
        }
        entity.address = venue.location.address
        entity.postalCode = venue.location.postalCode
        entity.city = venue.location.city
        entity.state = venue.location.state
        entity.cc = venue.location.cc
      }

      // Set the place category
      if (venue.categories) {
        venue.categories.forEach(function(category) {
          if (category.primary) {
            entity.category = {
              id: category.id,
              name: category.name,
            }
            return
          }
        })
      }

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
