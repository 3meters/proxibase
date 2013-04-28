
var log = console.log
var mongo = require('mongodb')
var server = new mongo.Server('localhost', 27017, {auto_reconnect: true})
var db = new mongo.Db('smokeData', server, {safe: true})

log(1)
// db.open(function(err, cls) {
  // log(2)
  // if (err) throw err
  db.dropDatabase(function(err) {
    log(3)
    if (err) throw err
    db.close()
  })
// })

