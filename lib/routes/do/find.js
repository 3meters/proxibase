/**
 * routes/do/find.js
 *
 * Same as GET /data or GET /stats get but with params in the body
 */


var stats = require('../stats')


module.exports = function(req, res) {

  req.collectionName = req.body.collection
  if (!req.collectionName) req.sName = req.body.stat

  // did the request include a collection or a stat
  if (!(req.collectionName || req.sName)) {
    return res.error(proxErr.missingParam('collection || stat'))
  }

  // prune cruft
  delete req.body.collection
  delete req.body.table
  delete req.body.stat

  // graft query string properties onto body, notibly user and session
  for (key in req.query) {
    req.body[key] = req.query[key]
  }

  // then replace the query object with the post body
  req.query = req.body
  req.method = 'get'

  // run it
  if (req.collectionName) {
    req.params.collection = req.collectionName
    util.db.collection(req.collectionName).safeFind(req.query, {user: req.user}, finish)
  }
  else {
    req.params.stat = req.sName
    stats.getStat(req, finish)
  }

  function finish(err, results) {
    if (err) return res.error(err)
    else return res.send(results)
  }
}
