/**
 * /routes/places/yelp.js
 *
 */

var categories = require('./categories')

// Get places from yelp
function get(options, cb) {

  var radius = options.radius || 250

  // Since yelp won't tell us where the places are, getting them 
  // merged properly by distance is impossible.  So we focus yelp
  // only on very close places, meaning they are useless in 
  // sparsely populated areas.
  // radius = 250

  var search = options.search || {
    path: 'search',
    query: {
      ll: options.location.lat + ',' + options.location.lng,
      radius_filter: radius,
    },
    timeout: options.timeout,
    log: options.log,
  }

  util.callService.yelp(search, function(err, res, body) {
    if (err) return cb(err)

    // Yelp only returns lat / lng for the center of the query
    // To be extra helpful, they move it a little bit from
    // what you ask for.
    // go ahead and set the location as the original query, but use
    // the radius as the accuracy boundary for later merging
    // with more accurate providers
    var loc = {
      lat: options.location.lat,
      lng: options.location.lng,
      accuracy: radius,
    }
    var venues = body.businesses

    if (!(venues && tipe.isNumber(venues.length))) {
      err = perr.partnerError('Yelp return unexpected results',
        {search: search, results: res.text})
      logErr(err)
      return cb(err)
    }

    var places = []
    var raw = (options.includeRaw) ? venues : null

    venues.forEach(function(venue) {

      // popularity filter
      if (venue.review_count < 10) return
      if (venue.is_closed) return

      // create a place object in the shape of one of our entities
      var place = {
        name: venue.name,
        schema: statics.schemaPlace,  // for use in munged entities array
        provider: {yelp: venue.id},
        phone: venue.phone,
        location: loc,
      }

      // picture
      /*
       * Jay: replace the filename at the end of the image URL with the following
       * to get different image sizes:
       *  s.jpg: up to 40×40
       *  ss.jpg: 40×40 square
       *  m.jpg: up to 100×100
       *  ms.jpg: 100×100 square
       *  l.jpg: up to 600×400
       *  ls.jpg: 250×250 square
       *  o.jpg: up to 1000×1000
       *  348s.jpg: 348×348 square
       */
      if (venue.image_url) {
        var imageUrl = venue.image_url.replace('/ms.jpg', '/l.jpg')
        place.photo = {
          source: 'yelp',
          prefix: imageUrl,
        }
      }

      // Set the place
      if (venue.location) {
        if (venue.location.address) {
          place.address = ''
          venue.location.address.forEach(function(line, i) {
            if (i) place.address += ', '
            place.address += line
          })
        }
        place.postalCode = venue.location.postal_code
        place.city = venue.location.city
        place.region = venue.location.state_code
        place.country = venue.location.country_code
      }

      // Yelp category format is [['Cat Name2', 'catid1'], ['Cat Name2', 'catid2']
      // TODO:  map yelp categories
      place.category = categories.getGeneric()  // Until we do the work to map yelp categories

      places.push(place)

    }) // forEach place

    cb(null, places, raw)
  })
}

exports.get = get
