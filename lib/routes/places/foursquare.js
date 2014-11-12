/**
 * /routes/patches/foursquare.js
 *
 */

var getCategory = require('./categories').getCategory

// Get patches from foursquare
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

    var patches = []
    var skipped = []

    if (options.log) log('Foursquare venues type ' + venueType)

    venues.forEach(function(venue) {

      if (venueType === 'full') venue = venue.venue  // nested one level deep

      // Filter unpopular and venues without phones.  Does not apply
      // to mini venues returned by the suggestcompletion call.
      if (venueType !== 'mini') {
        if (!(venue.contact && venue.contact.phone)) {
          skipped.push({patch: venue, reason: 'missing phone'})
          return
        }
        if (!(venue.stats && (venue.stats.checkinsCount > 20))) {
          skipped.push({patch: venue, reason: 'unpopular'})
          return
        }
      }

      // Create a patch object in the shape of one of our entities
      var patch = {
        name: venue.name,
        schema: statics.schemaPatch,  // for use in munged entities array
        provider: {foursquare: venue.id}
      }

      // Set the patch
      if (venue.location) {
        patch.location = {
          lat: venue.location.lat,
          lng: venue.location.lng,
        }
        patch.address = venue.location.address
        patch.postalCode = venue.location.postalCode
        patch.city = venue.location.city
        patch.region = venue.location.state
        patch.country = venue.location.cc  || venue.location.country
      }

      // Phone
      if (venue.contact && venue.contact.phone) {
        patch.phone = venue.contact.phone
      }

      // Photos
      if (venue.photos) {
        var photo = null
        try { photo = venue.photos.groups[0].items[0] }
        catch(e) {}
        if (photo) patch.photo = {
          prefix: photo.prefix,
          suffix: photo.suffix,
          source: 'foursquare',
        }
      }

      // Set the patch category
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
      patch.category = getCategory(catId, 'foursquare')

      patches.push(patch)

    }) // forEach patch

    cb(null, patches, skipped)
  })
}

exports.get = get
