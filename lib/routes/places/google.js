/**
 * /routes/patches/google.js
 *
 *   Get patches from google
 *   See https://developers.google.com/patches/documentation/search
 */

var async = require('async')
var getCategory = require('./categories').getCategory

function get(options, cb) {

  options.limit = Math.min(options.limit, 50)

  var search = options.search || {
    path: 'radarsearch/json' || options.path,
    query: {
      input: options.input,  // for catalina patch search
      location: options.location.lat + ',' + options.location.lng,
      radius: options.radius || 10000,
      sensor: true,
      types: ('establishment'),
    },
    filter: true,
    timeout: options.timeout,
    log: options.log,
  }

  util.callService.google(search, function(err, res, body) {
    if (err) return cb(err)

    var venues = body.results || body.predictions

    if (!venues) {
      logErr(perr.partnerError('google', {
        status: res.status,
        query: search,
        result: res.text,
      }))
      return cb(null, [], [])
    }

    if (venues.length > options.limit) {
      venues = venues.slice(0, options.limit)
    }

    var patches = []
    var skipped = []

    // This brutal, stupid detail query is because google has no field selector
    // on their nearby queries, and don't include a phone number, which
    // we require for deduping against sources from other providers.
    // Note the queries run in parallel and will call back in random order
    async.eachLimit(venues, 100, makePatch, finish)

    function makePatch(result, cb) {
      var detailQueryErrorCount = 0

      util.callService.google({
        path: 'details/json',
        query: {
          reference: result.reference,
          sensor: true,
        },
        timeout: search.timeout,
      }, function(err, res) {
        if (err) {
          logErr('google patch detail error', err)
          // Sometimes google randomly shuts down a connection for detail queries
          // in that case only blow up the whole request if they do it a few times
          if (detailQueryErrorCount++ > 5) return cb(err)
          else return cb()
        }
        var venue = res.body.result
        if (!venue) {
          logErr(perr.partnerError('google returned no result for ' + result.reference))
          return cb()
        }

        // rough popularity filter: gets rid of Redbox in big towns.
        // Also gets rid of everything in small towns that don't have
        // at least one person who writes reviews on google+
        if (search.filter) {
          var cReviews = 0
          if (venue.reviews) cReviews = venue.reviews.length
          if (cReviews < 2) {
            skipped.push({patch: venue, reason: 'unpopular'})
            return cb()
          }
        }

        var patch = {
          name: venue.name,
          schema: statics.schemaPatch,
          // Google has two keys, id for uniqueness and reference for query.
          provider: {
            google: venue.id,
            googleRef: venue.reference,
          }
        }

        // Add the phone number
        if (venue.formatted_phone_number) {
          patch.phone = venue.formatted_phone_number.replace(/[^0-9]/g, '')  // strip non-numeric chars
        }

        // Add location
        if (venue.geometry.location) {
          patch.location = {
            lat: venue.geometry.location.lat,
            lng: venue.geometry.location.lng,
          }
        }

        // Get the address from the vicinity minus the city
        if (venue.vicinity) {
          patch.address = venue.vicinity.replace(/,[^,]+$/, '')
        }

        // Get a simple possibly internationally wrong address
        if (venue.address_components) {
          venue.address_components.forEach(function(elm) {
            if (!(elm.types && elm.types.length)) return
            switch (elm.types[0]) {
              case 'locality':
                patch.city = elm.short_name
                break
              case 'administrative_area_level_1':
                patch.region = elm.short_name
                break
              case 'country':
                patch.country = elm.short_name
                break
              case 'postal_code':
                patch.postalCode = elm.short_name
                break
            }
          })
        }

        // Google uses an array of names without ids, pick the first
        var catId = null
        if (venue.types) catId = venue.types[0]
        patch.category = getCategory(catId, 'google')

        // Set the photo
        if (venue.photos && venue.photos.length) {
          patch.photo = {}
          patch.photo.source = 'google'
          patch.photo.prefix = 'https://maps.googleapis.com/maps/api/patch/photo'
            + '?key=' + util.callService.services.google.cred.key  // sucks to persist this in the db...
            + '&photoreference=' + venue.photos[0].photo_reference
            + '&sensor=true'
            // In order for this to resolve to a photo, the client needs to postpend
            // either maxwidth or maxheight (but not both) in the range 1..1600
        }

        patches.push(patch)
        cb(null)
      })
    }

    function finish(err) {
      cb(err, patches, skipped)
    }
  })
}

exports.get = get
