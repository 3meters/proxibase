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


var db = util.db
var mongo = require('../db')
var greeting = {}
var stats = {
  linksFromUsers: {
    refresh: genLinksFromUsers,
  }
}


// Stash app globals
exports.init = function(app) {
  db.sNames = {}
  greeting = {
    info: util.config.service.name + ' statistics',
    params: 'same find syntax as /data.  Set refresh=true to regenerate stat (requires admin)',
    stats: {}
  }
  for (stat in stats) {
    greeting.stats[stat] = util.config.service.url + '/stats/' + stat
  }
  greeting.docs = util.config.service.docsUrl + '#stats'
}


exports.addRoutes = function(app) {
  app.get('/stats', welcome)
  app.get('/stats/:stat/:userId?', getStat)
}


function welcome(req, res) {
  res.send(greeting)
}

var getStat = exports.getStat = function(req, res) { // arg can be cb or response object

  req.stat = stats[req.params.stat]
  if (!req.stat) return res.error(proxErr.notFound())

  req.collectionName = 'stats_' + req.params.stat
  req.collection = db[req.collectionName]

  req.refresh = tipe.isTruthy(req.query.refresh)
  if (req.refresh) {
    // must be admin to generate stats
    if (!req.asAdmin) return res.error(proxErr.badAuth())
  }

  if (!req.collection) req.refresh = true

  if (req.refresh) return req.stat.refresh(req, function(err) {
    if (err) return res.error(err)
    // Now set refresh to false and call again
    req.query.refresh = false
    return getStat(req, res)
  })

  // filter results for a single user
  // Use regular find syntax for more complicated filtering
  if (req.params.userId) {
    req.query.find = req.query.find || {}
    req.query.find._user = req.params.userId
  }

  if (tipe.isUndefined(req.query.lookups)) req.query.lookups = true
  delete req.query.refresh

  req.collection.safeFind(req.query, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}


/*
 * genLinksFromUsers
 *
 *  Create a persisted mongo collection of users ranked by entity count
 *  Intented to be run as a periodic batch process
 *  Computes intermediate results in a persisted working collection with 
 *  the _temp suffix, then, if all appears well, drops the results collection
 *  and renames temp to results.  
 */
function genLinksFromUsers(req, cb) {

  var map = function() {
    emit({
      user: this._from,
      schema: this.toSchema,
      type: this.type
    }, 1)
  }

  var reduce = function(k, v) {
      var count = 0
      v.forEach(function(c) { count+= c })
      return count
  }

  var options = {
    query: {fromSchema: 'user'},
    out: {inline: 1}
  }

  db.links.mapReduce(map, reduce, options, processResults)


  /*
   * processResults
   *   Mongo mapreduce produces results of form [_id, value]
   *   Transform those results into a persisted temporary collection
   *   of form [_id, entityCount, rank], then drop the existing results
   *   collection and rename the temp collection results
   */
  function processResults(err, results) {
    if (err) return cb(err)

    var schema = mongo.createSchema({
      name: 'stats_linksFromUsers',
      id: 'st_lfu',
      fields: {
        _id:        {type: 'string'},
        _user:      {type: 'string', ref: 'users'},
        collection: {type: 'string'},
        type:       {type: 'string'},
        count:      {type: 'number'},
        rank:       {type: 'number'},
      }
    })

    if (tipe.isError(schema)) return cb(schema)

    var docs = []
    var rank = 0
    results.sort(function(a, b) { return b.value - a.value })  // descending by value
    // transform the results collection
    results.forEach(function(raw) {
      rank++
      docs.push({
        _id: String(rank),
        _user: raw._id.user,
        collection: statics.schemas[raw._id.schema].collection,
        linkType: raw._id.type,
        count: raw.value
      })
    })

    // Create a new temp collection with the formatted results
    // then hot-swap the old collection
    mongo.initSchema(db, schema, function(err) {
      if (err) return cb(err)
      var temp = 'temp_' + schema.collection
      db.collection(temp).drop(function(err) {
        if (err) ;  // continue, may not exist
        db.createCollection(temp, function(err) {
          if (err) return cb(err)
          db.collection(temp).insert(docs, {safe: true}, function(err, savedDocs) {
            if (err) return cb(err)
            if (results.length !== savedDocs.length) return cb(proxErr.serverError())
            // temp collection looks ok, drop results and rename temp => results
            db.dropCollection(schema.collection, function(err) {
              if (err) ; // continue, may not exist
              db.collection(temp).rename(schema.collection, cb) // call back when done
            })
          })
        })
      })
    })
  }
}
