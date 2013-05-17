/**
 * /routes/places/factual.js
 *
 *   Get places from factual
 */

function get(req, cb) {

  var search = {
    path: '/t/places-v3',
    query: {geo: {
      $circle: {
        $center: [req.body.latitude, req.body.longitude],
        $meters: req.body.radius,
      }},
    limit: Math.min(50, req.body.limit + req.body.excludeCount)
    }
  }

  util.callService.factual(search, function(err, sres, body) {
    if (err) return cb(err)

    var places = []
    var raw = (req.body.includeRaw)
      ? body.data
      : null

    body.data.forEach(function(venue) {  // using foursquare's term venue for readability
      if (req.exclude(venue.factual_id)) return
      if (!(venue.category_ids && venue.category_ids.length)) return

      var entity = {
        name: venue.name,
        place: {
          lat: venue.latitude,
          lng: venue.longitude,
          address: venue.address,
          city: venue.locality,
          state: venue.region,
          postalCode: venue.postcode,
          cc: venue.country,
          provider: {
            factual: venue.factual_id
          },
        },
        sources: [{
          type: 'factual',
          id: String(venue.factual_id),
          name: venue.name || undefined,
          data: {origin: 'factual', originId: venue.factual_id}
        }],
      }

      if (venue.tel) {
        entity.place.phone = venue.tel.replace(/[^0-9]/g, '')  // strip non-numeric chars
        entity.place.formattedPhone = venue.tel
      }

      if (venue.category_ids) {
        // factual only has one now, but claim that will change
        var id = String(venue.category_ids[0])
        entity.place.category = {
          id: id,
          name: 'Place',
        }
      }

      if (venue.category_labels) {
        // factual's last category lable appears to be the most specific
        var last = venue.category_labels[0].length - 1
        entity.place.category.name = venue.category_labels[0][last]
      }

      if (venue.website) {
        entity.sources.push({
          type: 'website',
          id: venue.website,
          name: venue.website,
          data: {origin:'factual', originId: venue.factual_id}
        })
      }

      places.push(entity)
    })

    cb(null, places, raw)
  })
}

module.exports = get
