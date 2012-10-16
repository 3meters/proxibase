/**
 * routes/stats.js  compute and retrieve statistics
 *
 *    Statistics are stored as mongodb collections with the name stats_<statName>
 *    Retrieve stattics like so:
 *
 *        get /stats/<stat>
 *
 *    using the same options as get /data/<collection>
 *
 *    Each statistic has a cooresponding generation function.  Calling
 *
 *        get /stats/<stat>?refresh=true
 *
 *    while logged in as a admin will invoke the generation function before
 *    retrieving the collection
 *
 */


var util = require('util')
  , log = util.log
  , db = util.db
  , data = require('./data')
  , refresh = false
  , greeting = {}
  , stats = {
      usersByEntity: {
        generate: genUsersByEntityCount,
        lookups: {_id: 'users'}
      }
    }


// Stash welcome in module global
exports.init = function(app) {
  greeting = {
    info: util.config.service.name + ' statistics',
    params: 'same as /data plus refresh=true to regenerate stat (requires admin)',
    stats: {}
  }
  for (stat in stats) {
    greeting.stats[stat] = util.config.service.url + '/stats/' + stat
  }
  greeting.docs = util.config.service.docsUrl + '#stats'
}


exports.addRoutes = function(app) {
  app.get('/stats', welcome)
  app.get('/stats/:stat/:id?', scrub)
  app.get('/stats/:stat/:id?', getStat)
}


function welcome(req, res) {
  res.send(greeting)
}

function scrub(req, res, next) {
  req.stat = stats[req.params.stat]
  if (!req.stat) return res.error(httpErr.notFound)
  req.cName = 'stats_' + req.params.stat // mongodb collection name
  req.c = db.collection(req.cName)
  refresh = util.truthy(req.query.refresh)
  if (refresh) {
    // must be admin to generate stats
    if (!req.asAdmin) return res.error(httpErr.badAuth)
    delete req.query.refresh  // find doesn't know about the refresh param
  }
  if (req.query.lookups) req.query.lookups = req.stat.lookups // replicates schema refs in db/load.js
  next()
}

function getStat(req, res, next) {
  // gen new statistics collection, will call here again when done
  if (refresh) return req.stat.generate(req, res, getStat)
  data.parse(req, res)
  data.find(req, res, next)
}

/*
 * genUsersByEntityCount
 *
 *  Create a persisted mongo collection of users ranked by entity count
 *  Intented to be run as a periodic batch process
 *  Computes intermediate results in a persisted working collection with 
 *  the _temp suffix, then, if all appears well, drops the results collection
 *  and renames temp to results.  
 */
function genUsersByEntityCount(req, res, callback) {

  var results = 'stats_' + req.params.stat // mongodb results collection
    , temp = results + '_temp'

  var map = function() { emit(this._owner, 1) }  // count by entity owner
  var reduce = function(k, v) {
    var count = 0
    v.forEach(function(c) { count+= c })
    return count
  }
  var options = {out: {inline: 1}}  // in-memory
  db.entities.mapReduce(map, reduce, options, processResults)

  /*
   * processResults
   *   Mongo map-reduce jobs return results of form [_id, value]
   *   Transform those results into a persisted temporary collection
   *   of form [_id, entityCount, rank], then drop the existing results
   *   collection and rename the temp collection results
   */
  function processResults(err, rawDocs) {
    if (err) return res.error(err)
    var docs = [], rank = 0
    rawDocs.sort(function(a, b) { return b.value - a.value })  // descending by value
    rawDocs.forEach(function(rawDoc) {
      rank++
      docs.push({_id: rawDoc._id, entityCount: rawDoc.value, rank: rank})
    })
    db.collection(temp).drop(function(err) {
      if (err) ;  // continue, may not exist
      db.createCollection(temp, function(err) {
        if (err) return res.error(err)
        db.collection(temp).insert(docs, {safe: true}, function(err, savedDocs) {
          if (err) return res.error(err)
          if (rawDocs.length !== savedDocs.length) return res.error(new Error('Unexpected Error'))
          // temp collection looks ok, drop results and rename temp => results
          db.dropCollection(results, function(err) {
            if (err) ; // continue, may not exist
            db.collection(temp).rename(results, function(err) {
              if (err) return res.error(err)
              // now set refresh to false and call getStat again, returning the refreshed collection
              refresh = false
              return callback(req, res)
            })
          })
        })
      })
    })
  }
}
