/**
 * routes/data/stats.js
 *
 *    rest routes for fetching and refershing pre-computed statistics
 *
 *        get|post /find|data/collection/stat/<statName>/:id
 *
 *    using the same options as get /find/<collection>
 *
 *    Each statistic has a cooresponding generation function.  Calling
 *
 *        get ?refresh=true
 *
 *    while logged in as a admin will invoke the generation function before
 *    retrieving the collection
 *
 */


var stats = require('../stats').stats


module.exports = function(req, res) {

  if (!(req.params.stat && stats[req.collectionName]
        && stats[req.collectionName][req.params.stat])) {
    return res.error(proxErr.notFound())
  }

  req.refresh = tipe.isTruthy(req.query.refresh)
  if (req.refresh) {
    // must be admin to request a refresh
    if (!req.asAdmin) return res.error(proxErr.badAuth())
  }

  // Issue https://github.com/3meters/proxibase/issues/142
  // This is a worker-specific global that needs to be shared
  // across the cluster
  req.collectionName = 'stats_' + req.params.stat
  req.collection = db[req.collectionName]

  if (!req.collection) req.refresh = true

  if (req.refresh) return req.stat.refresh(req, function(err) {
    if (err) return res.error(err)
    // Now set refresh to false and call again
    req.query.refresh = false
    return getStat(req, res)
  })

  // filter results for a single user
  // Use regular query syntax for more complicated filtering
  var selector = {}
  if (req.params.userId) {
    selector._user = req.params.userId
  }

  // Accept a query parameter on the stat collection
  if (req.query.query) {
    selector = req.query.query
    delete req.query.query
  }

  var findOps = {user: req.user}
  if (tipe.isUndefined(req.query.lookups)) findOps.lookups = true
  delete req.query.refresh

  req.collection.safeFind(selector, findOps, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}
