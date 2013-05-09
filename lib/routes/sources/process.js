/**
 * sources/process.js
 *
 *   process a source
 */
var _sources = util.statics.sources

var workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
}

module.exports = function(source, scope, cb) {

  var _source = _sources[source.type]
  if (!_source) return bail('Unknown source type')

  var originalSource = util.clone(source)

  var worker = workers[source.type]
  normalize()
  var sourceMap = scope.sourceMap

  // No getter
  if (!(worker && worker.get)) {
    return finish()
  }

  // Validated within the last period
  var fresh = util.now() - (1000 * 60)
  if (source.data.validated && source.data.validated > fresh) {
    return finish()
  }

  // Dupe
  if (sourceMap[source.type] && sourceMap[source.type][source.id]) {
    return finish()
  }

  // Call getter
  worker.get(source, scope, function(err, validSource) {
    if (err) return bail(err)
    source = validSource
    finish()
  })

  // Add the source and call back
  function finish() {
    if (source && (source.id || source.url)) addSource()
    cb()
  }

  // Normalize source id so they can be deduped
  function normalize() {
    if (source.id) source.id = String(source.id)
    if (source.url) source.url = String(source.url)
    source.data = source.data || {}
    if (worker && worker.normalize) { // type-specific normalizer
      worker.normalize(source)
    }
  }

  // Add or overwrite source in scope
  function addSource() {
    // log('debug process adding to sourceMap: ' + source.type + '.' + source.id)
    var sourceMap = scope.sourceMap
    delete source.query
    sourceMap[source.type] = sourceMap[source.type] || {}
    // worker-specific dedupers belong here
    sourceMap[source.type][source.id] = sourceMap[source.type][source.id] || source
  }

  // Log the best error we can and return
  function bail(err) {
    if (!type.isError(err)) {
      if (type.isString(err)) err = perr.badSource(err)
      else err = perr.badSource('', err)
    }
    err.source = originalSource
    logErr(err)
    cb()
  }
}
