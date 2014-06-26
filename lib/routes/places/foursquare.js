/**
 * /routes/places/foursquare.js
 *
 */

var getCategory = require('./categories').getCategory

// Get places from foursquare
function get(options, cb) {

  options.limit = Math.min(options.limit, 50)

  var search = options.search || {
    path: 'search',
    query: {
      ll: options.location.lat + ',' + options.location.lng,
      radius: options.radius,
      limit: options.limit,
    },
    timeout: options.timeout,
    log: options.log,
  }

  util.callService.foursquare(search, function(err, res, body) {
    if (err) return cb(err)

    var venues = body.response.venues || body.response.minivenues
    var isFullVenue = (body.response.venues)

    if (!(venues && tipe.isNumber(venues.length))) {
      err = perr.partnerError('Foursquare returned unexpected results',
          {search: search, result: res.text})
      logErr(err)
      return cb(err)
    }

    var places = []
    var raw = (options.includeRaw)
      ? venues
      : null

    venues.forEach(function(venue) {

      // We dedupe on phone number
      if (isFullVenue && !(venue.contact && venue.contact.phone)) return

      // popularity filter
      if (isFullVenue) {
        if (!(venue.stats && venue.stats.checkinsCount)) return
        if (venue.stats.checkinsCount < 20) return
        if ((venue.stats.checkinsCount < 500) && !(venue.contact && venue.contact.phone)) return
      }

      // create a place object in the shape of one of our entities
      var place = {
        name: venue.name,
        schema: statics.schemaPlace,  // for use in munged entities array
        provider: {foursquare: venue.id}
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

      if (isFullVenue) {
        place.phone = venue.contact.phone
        // Set the place photo
        var photo = null
        try { photo = venue.photos.groups[0].items[0] }
        catch (e) {}
        if (photo) place.photo = {
          prefix: photo.prefix,
          suffix: photo.suffix,
          source: 'foursquare'
        }
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
      }
      place.category = getCategory(catId, 'foursquare')

      places.push(place)

    }) // forEach place

    cb(null, places, raw)
  })
}

exports.get = get
