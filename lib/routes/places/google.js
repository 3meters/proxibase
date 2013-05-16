/**
 * /routes/places/google.js
 *
 *   Get places from google
 *   See https://developers.google.com/places/documentation/search
 */

var async = require('async')

function get(req, cb) {

  var iconPath = '/img/categories/google/'
  var search = {
    path: 'nearbysearch/json',
    query: {
      location: req.body.latitude + ',' + req.body.longitude,
      radius: req.body.radius,
      sensor: true,
    },
    log: true
  }

  util.callService.google(search, function(err, res) {
    if (err) return cb(err)
    if (!res.body.results) {
      logErr(perr.partnerError('google', {
        status: res.status,
        query: search,
        result: res.text,
      }))
      return cb(null, [], [])
    }

    var places = []
    var raw = (req.body.includeRaw)
      ? {nearby: res.body.results, details: []}
      : null

    var results = res.body.results.slice(0, req.body.limit)

    // This brutal, stupid detail query is because google has no field selector
    // on their nearby queries, and don't include a phone number, which
    // we require for deduping against sources from other providers.
    // Note the queries run in parallel and will call back in random order
    async.each(results, makePlace, finish)

    function makePlace(result, cb) {
      if (req.exclude(result.id)) return cb()

      util.callService.google({
        path: 'details/json',
        query: {
          reference: result.reference,
          sensor: true,
        },
      }, function(err, res) {
        if (err) return cb(err)
        var venue = res.body.result
        if (!venue) {
          logErr(perr.partnerError('google returned no result for ' + result.reference))
          return cb()
        }

        if (req.body.includeRaw) raw.details.push(venue)

        // Create a place object in the shape of one of our entities
        var googlePlace = {
          name: venue.name,
          place: {
            // google has two keys, id for uniqueness and reference for query.
            // No idea why. Storing separately for now, but googleReference
            // will not match our providers map.  Alternatively could glom the two
            // strings together sparated by a pipe and split them apart everytime
            // we needed them.
            provider: {
              google: venue.id,
              googleReference: venue.reference,
            },
          },
          sources: [{
            type: 'google',
            id: venue.id,
            name: venue.name || undefined,
            data: {origin: 'google', originId: venue.id, originReference: venue.reference},
          }],
        }

        // Add the phone number
        if (venue.formatted_phone_number) {
          googlePlace.place.contact = {
            formatedPhone: venue.formatted_phone_number,
            phone: venue.formatted_phone_number.replace(/[^0-9]/g, ''),  // strip non-numeric chars
          }
        }

        // The only address info in Google's nearby query is lat,lng
        if (venue.geometry.location) {
          googlePlace.place.location = {
            lat: venue.geometry.location.lat,
            lng: venue.geometry.location.lng,
          }
        }

        // Get the address from the vicinity minus the city
        if (venue.vicinity) {
          googlePlace.place.location.address = venue.vicinity.replace(/,[^,]+$/, '')
        }

        // Get a simple possibly internationally wrong address
        if (venue.address_components) {
          venue.address_components.forEach(function(elm) {
            if (!(elm.types && elm.types.length)) return
            switch (elm.types[0]) {
              case 'locality':
                googlePlace.place.location.city = elm.short_name
                break
              case 'administrative_area_level_1':
                googlePlace.place.location.state = elm.short_name
                break
              case 'country':
                googlePlace.place.location.cc = elm.short_name
                break
              case 'postal_code':
                googlePlace.place.location.postalCode = elm.short_name
                break
            }
          })
        }

        // Google uses an array of names without ids, pick the first
        if (venue.types) {
          googlePlace.place.category = {
            id: venue.types[0],
            name: venue.types[0],
          }
        }
        places.push(googlePlace)
        cb(null)
      })
    }

    function finish(err) {
      cb(err, places, raw)
    }
  })
}

module.exports = get
