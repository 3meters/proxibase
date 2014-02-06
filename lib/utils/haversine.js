/**
 * haversine:  Return the distance between two points on the earth in meters
 */

var isNumber = require('./').tipe.isNumber

module.exports = function (lat1, lng1, lat2, lng2) {

  if (!(isNumber(lat1) && isNumber(lng1) && isNumber(lat2) && isNumber(lng2))) {
    return new Error('Invalid arguments to haversine')
  }

  var R = 6371000 // radius of earth = 6371km at equator

  // calculate delta in radians for latitudes and longitudes
  var dLat = (lat2 - lat1) * Math.PI / 180
  var dLng = (lng2 - lng1) * Math.PI / 180

  // get the radians for lat1 and lat2
  var lat1rad = lat1 * Math.PI / 180
  var lat2rad = lat2 * Math.PI / 180

  // calculate the distance d
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1rad) * Math.cos(lat2rad)
        * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  var d = R * c
  return d
}
