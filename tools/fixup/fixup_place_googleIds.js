// Fixup google provider ids
//   from provider.google: id|ref
//   to provider.google: id
//  and provider.googleRef: ref

var db = require('proxdb')
var utils = require('proxutils')
var log = utils.log
var logErr = utils.logErr

db.initDb(function(err) {
  if (err) {
    logErr(err)
    process.exit(1)
  }
  db.places.safeEach({}, fix, {}, function(err, count) {
    if (err) utils.logErr(err)
    log('Fixed ' + count + ' places')
  })
})

function fix(place, cb) {

  if (!(place.provider && place.provider.google)) {
    return cb()
  }

  var idParts = place.provider.google.split('|')
  if (idParts.length !== 2) {
    return cb()
  }

  place.provider.google = idParts[0]
  place.provider.googleRef = idParts[1]

  db.places.safeUpdate(place, {asAdmin: true}, cb)

}
