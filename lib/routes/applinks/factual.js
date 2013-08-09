/**
 * applinks/factual.js
 *
 *  Query factual
 */

var _applinks = util.statics.applinks

function get(applink, scope, cb) {

  if (scope.refreshOnly) return cb(null, null) // paranoid

  if (!applink) return perr.badApplink(applink)

  if (applink.appId) {
    // We already have a factual Id, skip directly to crosswalk
    return getCrosswalk(applink, scope, cb)
  }

  if (!(applink.data && applink.data.query)) return cb()

  var query = applink.data.query
  if (!(query.namespace && query.namespace_id)) return cb()

  var search = {
    path: '/t/crosswalk',
    query: {filters: query}
  }

  // Get the factual Id of a non-factual applink
  util.callService.factual(search, function(err, res) {
    if (err) return cb(perr.partnerError('Factual', err))
    if (!(res.body && res.body.data && res.body.data.length)) return cb()
    var factualId = res.body.data[0].factual_id
    if (!factualId) return cb(perr.badApplink('Missing factual_id'))
    applink.appId = factualId
    getCrosswalk(applink, scope, cb)
  })
}


function getCrosswalk(applink, scope, cb) {

  var raw = scope.raw
  var query = applink.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: {factual_id: applink.appId}, limit: 50},
    log: false,
  }

  util.callService.factual(search, function(err, res, body) {
    if (err) return cb(err)
    var results = body.data
    if (!(results && results.length)) {
      return cb(perr.badApplink('No results from factual'))
    }

    if (scope.raw) scope.raw.factualCandidates = results
    results.forEach(function(result) {
      if (_applinks[result.namespace]) {
        scope.applinkQ.push({
          type: result.namespace,
          schema: util.statics.schemaApplink,
          appId: result.namespace_id,
          appUrl: result.url,
          data: {origin: 'factual', originId: applink.appId}
        })
      }
    })
    applink.data.validated = util.now()
    cb(null, null) // we don't retain the factual applink
  })
}

exports.get = get
