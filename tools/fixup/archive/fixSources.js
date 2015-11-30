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
  .option('-d, --database <database>', 'database')
  .option('-x, --execute', 'execute the update, otherwise just returns prepared updates')
  .option('-i, --unsetIcons', 'unset the icon property of all sources')

  .parse(process.argv)

var toFix = [
  {
    type: 'facebook',
    prefix: 'https://graph.facebook.com/',
    suffix: '/picture?type=large',
    fixed: 0,
  },
  {
    type: 'twitter',
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=',
    suffix: '&size=bigger',
    fixed: 0,
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
    computeNewSources(function(err) {
      if (err) return finish(err)
      if (!cli.execute) return finish()
      async.forEachSeries(results, saveNewSource, finish)
    })
  })
}

function computeNewSources(cb) {
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
        if (cli.unsetIcons) delete source.icon
        toFix.forEach(function(fix) {
          if (source.type !== fix.type) return
          if (!source.id) return
          source.photo = {
            prefix: fix.prefix + source.id + fix.suffix,
            sourceName: fix.type
          }
          fix.fixed++
        })
      })
      results.push({old: old, doc: doc})
    })
    return cb(null)
  })
}

function saveNewSource(result, cb) {
  var doc = result.doc
  // Not safe update, bypasses validation and security
  db.entities.update({_id: doc._id}, {$set: {sources: doc.sources}}, cb)
}

function finish(err) {
  if (err) throw err
  log('addPhotos ok, results', {
    fixed: toFix,
    docs: results
  }, {depth:7})
  process.exit()
}

start()
