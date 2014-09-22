// Fixup google provider ids
//   from provider.google: id|ref
//   to provider.google: id
//  and provider.googleRef: ref

require('proxutils')
var mongo = require('proxdb')
var db

var config = {
  host: 'localhost',
  port: 27017,
  database: 'prox',                   // dev:prox test:smokeData stage:stage production:prox perfTest: perfTest
  limits: {
    default: 50,
    max: 1000,
    join: 1000,
  },
}

mongo.initDb(config, function(err, initDb) {
  if (err) {
    logErr(err)
    process.exit(1)
  }
  db = initDb
  db.places.count({}, function(err, count) {
    log('Total places: ' + count)
    db.places.safeEach({}, {}, fix, function(err, count) {
      if (err) logErr(err)
      else log('\nFixed ' + count + ' places')
      db.close()
    })
  })
})


// Perform the fix
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

  if (place.provider.google1) place.provider.google1 = null
  if (place.provider.google2) place.provider.google2 = null

  db.places.safeUpdate(place, {asAdmin: true}, cb)

}
