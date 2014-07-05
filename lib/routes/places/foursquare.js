/**
 * /routes/places/foursquare.js
 *
 */

var getCategory = require('./categories').getCategory

// Get places from foursquare
function get(options, cb) {

  options.limit = Math.min(options.limit, 50)

  var search = options.search || {
    // path: 'search',
    path: 'explore',
    query: {
      // intent: 'browse',
      venuePhotos: 1,
      sortByDistance: 1,
      ll: options.location.lat + ',' + options.location.lng,
      radius: options.radius,
      limit: options.limit,
    },
    timeout: options.timeout,
    log: options.log,
  }

  // Depending on the query path foursquare returns differnt shaped results.
  var venueType = function() {
    switch (search.path) {
      case 'suggestcompletion': return 'mini'
      case 'search': return 'compact'
      case 'explore': return 'full'
    }
  }()
  if (!venueType) {
    return cb(perr.serverError('Unsupported foursquare path', search.path))
  }


  util.callService.foursquare(search, function(err, res, body) {
    if (err) return cb(err)

    var isFullVenue = (body.response.venues)
    var venues = function() {
      switch (venueType) {
        case 'mini':    return body.response.minivenues
        case 'compact': return body.response.venues
        case 'full':    return body.response.groups[0].items
      }
    }()

    if (!(venues && tipe.isNumber(venues.length))) {
      err = perr.partnerError('Foursquare returned unexpected results',
          {search: search, result: res.text})
      logErr(err)
      return cb(err)
    }

    var places = []
    var raw = (options.includeRaw) ? venues : null
    if (options.log) log('Foursquare venues type ' + venueType)

    venues.forEach(function(venue) {

      if (venueType === 'full') venue = venue.venue  // nested one level deep

      // We dedupe on phone number
      if (isFullVenue && !(venue.contact && venue.contact.phone)) return

      // popularity filter
      if (venueType !== 'mini') {
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

      // Phone
      if (venue.contact && venue.contact.phone) {
        place.phone = venue.contact.phone
      }

      // Photos
      if (venue.photos) {
        var photo = null
        try { photo = venue.photos.groups[0].items[0] }
        catch(e) {}
        if (photo) place.photo = {
          prefix: photo.prefix,
          suffix: photo.suffix,
          source: 'foursquare',
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
