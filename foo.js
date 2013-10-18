
var util = require('proxutils')
var log = util.log
var mongo = require('mongodb')
var host = 'localhost'
var port = 27017
var dbname = 'prox'
var options = {
  auto_reconnect: true,
  safe: true
}

mongo.Db.prototype.mymeth = function() {
  log('mymeth was called')
  log('this.foo', this.foo)
}

var server = new mongo.Server(host, port, options)
var db = new mongo.Db(dbname, server, {safe:true})

db.open(function(err, db2) {
  db.foo = 'bar'
  db2.foo = 'baz'

  db.mymeth()
  db2.mymeth()
})


/*
mongo.myFunction = function() {
  log('I am alive')
}

log('mongo.keys', Object.keys(mongo))

mongo.myFunction()
*/
