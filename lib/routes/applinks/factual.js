/**
 * applinks/factual.js
 *
 *  Query factual
 */

var _applinks = util.statics.applinks

function get(ent, scope, cb) {

  if ((!ent && ent.applink)) return perr.badApplink(ent)

  if (ent.applink.id) {
    // We already have a factual Id, skip directly to crosswalk
    return getCrosswalk(ent, scope, cb)
  }

  if (!(ent.applink.data && ent.applink.data.query)) return cb()

  var query = ent.applink.data.query
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
    ent.applink.id = factualId
    getCrosswalk(ent, scope, cb)
  })
}


function getCrosswalk(ent, scope, cb) {

  var raw = scope.raw
  var query = ent.applink.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: {factual_id: ent.applink.id}, limit: 50},
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
        scope.applinksQ.push({
          type: util.statics.typeApplink,
          applink: {
            type: result.namespace,
            id: result.namespace_id,
            url: result.url,
            data: {origin: 'factual', originId: ent.applink.id}
          }
        })
      }
    })
    ent.applink.data.validated = util.now()
    cb(null, ent)
  })
}

exports.get = get