/**
 * sources/factual.js
 *
 *  Query factual
 */

var _sources = util.statics.sources

function get(source, scope, cb) {

  if (source.id) {
    source.query = {factual_id: source.id}
    return getCrosswalk(source, scope, cb)
  }

  var query = source.query
  if (!(query.namespace && query.namespace_id)) return cb()

  var search = {
    path: '/t/crosswalk',
    query: {filters: query}
  }
  // Get the factual Id of a non-factual source
  util.callService.factual(search, function(err, res) {
    if (err) { logErr(err); return cb() }
    if (!(res.body && res.body.data && res.body.data.length)) return cb()
    var factualId = res.body.data[0].factual_id
    if (!factualId) return cb(perr.badSource('Missing factual_id'))
    source.query = {factual_id: factualId}
    getCrosswalk(source, scope, cb)
  })
}

function getCrosswalk(source, scope, cb) {
  var raw = scope.raw
  var query = source.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: query, limit: 50},
  }

  util.callService.factual(search, function(err, res, body) {
    if (err) return cb(err)
    var results = body.data
    if (!(results && results.length)) {
      return cb(perr.badSource('No results from factual'))
    }

    if (scope.raw) scope.raw.factualCandidates = results
    results.forEach(function(result) {
      if (_sources[result.namespace]) {
        scope.sourceQ.push({
          type: result.namespace,
          id: result.namespace_id,
          url: result.url,
          data: {origin: 'factual', originId: query.factual_id}
        })
        // TODO: push websites onto the Q
      }
    })
  })
}

exports.get = get
