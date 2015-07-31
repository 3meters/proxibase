/*
 * util/latLngToLocation
 *
 *   parse a comma-delimited latLng parameter into one of our location objects
 *   accepts an optional third parameter for altitude
 */

module.exports = function(llStr) {
  var loc = {}
  if (!llStr.length) return loc
  var ll = llStr.split(',')
  if (ll.length >= 2) {
    loc = {
      lat: Number(ll[0]),
      lng: Number(ll[1]),
    }
  }
  if (ll.length >= 3) loc.altitude = Number(ll[2])
  return loc
}
