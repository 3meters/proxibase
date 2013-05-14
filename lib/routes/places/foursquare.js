/**
 * /routes/places/foursquare.js
 *
 */

var _sources = util.statics.sources
var iconSuffix = '_88.png'


// Get places from foursquare
function get(req, cb) {

  var iconPath = '/img/categories/foursquare/'
  var search = {
    path: 'search',
    query: {
      ll: req.body.latitude + ',' + req.body.longitude,
      radius: req.body.radius,
      limit: Math.min(50, req.body.limit + req.body.excludeCount)
    },
    log: true,
  }

  util.callService.foursquare(search, function(err, sres, body) {

    if (err) return res.error(perr.partnerError('foursquare', err))
    try {var l = body.response.venues.length} catch(e) {
      logErr('Error: call to foursquare: ', search)
      logErr('Returned unexpected results:', sres.text)
      return finish(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? sres.body.response.venues
      : null

    body.response.venues.forEach(function(venue) {
      if (req.exclude(venue.id)) return

      // create a place object in the shape of one of our entities
      var fourPlace = {
        name: venue.name,
        sources: [],
        place: {
          provider: {foursquare: venue.id}
        }
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
              icon: iconPath + category.id + iconSuffix
            }
          }
        })
      }

      // set the sources
      var source = {
        type: 'foursquare',
        id: venue.id,
        name: venue.name || undefined,
        data: {origin: 'foursquare', originId: venue.id}
      }
      _.extend(source, _sources.foursquare.props)
      fourPlace.sources.push(source)

      if (venue.url) {
        source = {
          type: 'website',
          id: venue.url,
          name: venue.url,
          data: {origin:'foursquare', originId: venue.id}
        }
        _.extend(source, _sources.website.props)
        fourPlace.sources.push(source)
      }

      if (venue.contact && venue.contact.twitter) {
        source = {
          type:'twitter',
          id: venue.contact.twitter,
          data: {origin:'foursquare', originId: venue.id},
        }
        _.extend(source, _sources.twitter.props)
        fourPlace.sources.push(source)
      }

      places.push(fourPlace)

    }) // forEach place

    cb(null, places, raw)
  })
}

module.exports = get
