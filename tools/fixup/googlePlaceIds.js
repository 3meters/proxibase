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

mongo.initDb(config, function(err, db) {
  if (err) {
    logErr(err)
    process.exit(1)
  }
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

  var upd = {
    $set: {
      'provider.google': idParts[0],
      'provider.googleRef': idParts[1],
    },
    $unset: {
      'provider.google1': '',
      'provider.google2': '',
    }
  }


  db.places.update({_id: place._id}, upd, cb)

}
