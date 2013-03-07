/**
 * sources/factual.js
 *
 *  Query factual
 */

var normalize = require('./normalize')
var _sources = util.statics.sources

function getFactualId(options, cb) {
  var newSources = options.newSources
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
    options.query = {factual_id: factualId}
    getCrosswalk(options, cb)
  })
}

function getCrosswalk(options, cb) {
  var newSources = options.newSources
  var raw = options.raw
  var query = options.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: query},
  }

  util.callService.factual(search, function(err, res, body) {
    if (err) { logErr(err); return cb() }
    var results = body.data
    if (!(results && results.length)) return cb()

    if (options.raw) options.raw.factualCandidates = results
    var candidates = []
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

    var returned = 0
    candidates.forEach(function(candidate) {
      normalize(candidate, function(err, source) {
        if (err) return cb(err)
        if (source) newSources.push(source)
        if (++returned >= candidates.length) return cb()
      })
    })
  })
}

exports.getFactualId = getFactualId
exports.getCrosswalk = getCrosswalk
