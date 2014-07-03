/**
 * /routes/places/google.js
 *
 *   Get places from google
 *   See https://developers.google.com/places/documentation/search
 */

var async = require('async')
var getCategory = require('./categories').getCategory

function get(options, cb) {

  options.limit = Math.min(options.limit, 50)

  var search = options.search || {
    path: 'radarsearch/json' || options.path,
    query: {
      input: options.input,  // for catalina place search
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

    var places = []
    var raw = (options.includeRaw)
      ? {nearby: venues, details: []}
      : null

    // This brutal, stupid detail query is because google has no field selector
    // on their nearby queries, and don't include a phone number, which
    // we require for deduping against sources from other providers.
    // Note the queries run in parallel and will call back in random order
    async.eachLimit(venues, 100, makePlace, finish)

    function makePlace(result, cb) {
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
          logErr('google place detail error', err)
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

        // rough popularity filter
        // gets rid of Redbox.
        if (search.filter) {
          if (!(venue.reviews && (venue.reviews.length > 2))) {
            if (search.log) log('google venue failing popularity test:', venue.name)
            return cb()
          }
        }

        if (options.includeRaw) raw.details.push(venue)

        var place = {
          name: venue.name,
          schema: statics.schemaPlace,  // for use in munged entities array
          // google has two keys, id for uniqueness and reference for query.
          // We glom the two strings together sparated by a pipe we must split
          // them apart to execute a detail query.
          provider: {
            google: venue.id + '|' + venue.reference,
          }
        }

        // Add the phone number
        if (venue.formatted_phone_number) {
          place.phone = venue.formatted_phone_number.replace(/[^0-9]/g, '')  // strip non-numeric chars
        }

        // Add location
        if (venue.geometry.location) {
          place.location = {
            lat: venue.geometry.location.lat,
            lng: venue.geometry.location.lng,
          }
        }

        // Get the address from the vicinity minus the city
        if (venue.vicinity) {
          place.address = venue.vicinity.replace(/,[^,]+$/, '')
        }

        // Get a simple possibly internationally wrong address
        if (venue.address_components) {
          venue.address_components.forEach(function(elm) {
            if (!(elm.types && elm.types.length)) return
            switch (elm.types[0]) {
              case 'locality':
                place.city = elm.short_name
                break
              case 'administrative_area_level_1':
                place.region = elm.short_name
                break
              case 'country':
                place.country = elm.short_name
                break
              case 'postal_code':
                place.postalCode = elm.short_name
                break
            }
          })
        }

        // Google uses an array of names without ids, pick the first
        var catId = null
        if (venue.types) catId = venue.types[0]
        place.category = getCategory(catId, 'google')

        // Set the photo
        if (venue.photos && venue.photos.length) {
          place.photo = {}
          place.photo.source = 'google'
          place.photo.prefix = 'https://maps.googleapis.com/maps/api/place/photo'
            + '?key=' + util.callService.services.google.cred.key  // sucks to persist this in the db...
            + '&photoreference=' + venue.photos[0].photo_reference
            + '&sensor=true'
            // In order for this to resolve to a photo, the client needs to postpend
            // either maxwidth or maxheight (but not both) in the range 1..1600
        }

        places.push(place)
        cb(null)
      })
    }

    function finish(err) {
      cb(err, places, raw)
    }
  })
}

exports.get = get
