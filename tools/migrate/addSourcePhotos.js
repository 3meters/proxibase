/**
 * Add photo properties to facebook and twitter sources
 */

var util = require('proxutils')
var log = util.log
var dblib = require('proxdb')
var mongo = dblib.mongodb
var cli = require('commander')
var async = require('async')
var db
var results = []

cli
  .option('-c, --config <file>', 'config file [config.js]')
  .option('-d, --database <database>', 'database name [proxTest|prox]')
  .option('-x, --execute', 'execute the update, otherwise just returns prepared updates')

var queries = [
  {
    type: 'facebook',
    prefix: 'https://graph.facebook.com/',
    suffix: '/picture?type=large',
  },
  {
    type: 'twitter',
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=',
    suffix: '&size=bigger',
  },
]
function start() {

  if (cli.config) util.setConfig(cli.config)
  var config = util.config
  if (cli.database) config.db.database = cli.database
  dblib.init(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    db = util.db = connection
    setPicture(queries, finish)
  })
}

function setPicture(queries, cb) {
  db.entities.find({
    type: 'com.aircandi.candi.place',
  }, {name: 1, sources: 1})
  .toArray(function(err, docs) {
    if (err) return cb (err)
    var out = []
    docs.forEach(function(old) {
      if (!util.type.isArray(old.sources)) return
      var doc = util.clone(old)
      doc.sources.forEach(function(source) {
        delete source.icon
        queries.forEach(function(query) {
          if (source.type !== query.type) return
          if (!source.id) return
          source.photo = {
            prefix: query.prefix + source.id + query.suffix,
            sourceName: query.type
          }
        })
      })
      results.push({old: old, doc: doc})
    })
    return cb(null)
  })
}

function finish(err) {
  if (err) throw err
  log('addPhotos ok, results', results, {depth:7})
  process.exit()
}

start()
