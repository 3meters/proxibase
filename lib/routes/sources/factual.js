/**
 * sources/factual.js
 *
 *  Query factual
 */

var _sources = util.statics.sources

function get(source, scope, cb) {

  var query = source.query || {}
  if (!(query.namespace && query.namespace_id)) return cb()

  if (query.namespace === 'factual') {
    return getCrosswalk(source, scope, cb)
  }
  else {
    var search = {
      path: '/t/crosswalk',
      query: {filters: query}
    }
    // Get the factual Id of a non-factual source
    util.callService.factual(search, function(err, res) {
      if (err) { logErr(err); return cb() }
      if (!(res.body && res.body.data && res.body.data.length)) return cb()
      try { var factualId = res.body.data[0].factual_id }
      catch (e) { logErr(e); return cb() }
      source.query = {factual_id: factualId}
      getCrosswalk(source, scope, cb)
    })
  }
}

function getCrosswalk(source, scope, cb) {
  var raw = scope.raw
  var query = scope.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: query, limit: 50},
  }

  util.callService.factual(search, function(err, res, body) {
    if (err) { logErr(err); return cb() }
    var results = body.data
    if (!(results && results.length)) {
      logErr(perr.badSource('No results from factual'))
      return cb()
    }

    if (scope.raw) scope.raw.factualCandidates = results
    results.forEach(function(result) {
      if (_sources[result.namespace]) {
        scope.sourceQ.push({
          type: result.namespace,
          id: result.namespace_id,
          url: result.url,
          data: {origin: 'factual'}
        })
        // TODO: push websites onto the Q
      }
    })
  })
}

exports.get = get
