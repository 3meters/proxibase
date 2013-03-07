/**
 * sources/factual.js
 *
 *  Query factual
 */

var normalize = require('./normalize')
var _sources = util.statics.sources

function getFactualByPartnerId(options, cb) {
  var newSources = options.newSources
  var raw = options.raw
  var query = options.query

  if (!(query.namespace && query.namespace_id)) return cb()
  var search = {
    path: '/t/crosswalk',
    query: {filters: query}
  }
  util.callService.factual(search, function(err, res) {
    if (err) { logErr(err); return cb() }
    if (!(res.body && res.body.data && res.body.data.length)) return cb()
    try { var factualId = res.body.data[0].factual_id }
    catch (e) { logErr(e); return cb() }
    getFactualByFactualId(factualId, cb)
  })
}

function getFactualByFactualId(factualId, cb) {
  var search = {
    path: '/t/crosswalk',
    query: {filters: {factual_id: factualId}},
  }
  util.callService.factual(search, function(err, res, body) {
    if (err) { logErr(err); return cb() }
    var results = body.data
    if (!(results && results.length)) return cb()

    var candidates = []
    var raw = []
    results.forEach(function(result) {
      if (_sources[result.namespace]) {
        candidates.push({
          type: result.namespace,
          id: result.namespace_id,
          url: result.url,
          data: {origin: 'factual'}
        })
      }
    })

    async.forEach(candidates, normalize, function(err, sources) {
      cb(err, sources, candidates)
    })
  })
}

exports.getFactualByPartnerId = getFactualByPartnerId
exports.getFactualByFactualId = getFactualByFactualId
