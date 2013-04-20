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

  // Log the best error we can and return
  function bail(err) {
    if (!type.isError(err)) {
      if (type.isString(err)) err = perr.badSource(err)
      else err = perr.badSource('', err)
    }
    logErr(err.message, source)
    if (err.info) logErr(err.info)
    if (err.stack) logErr(util.appStack(err.stack))
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
    log('debug process adding to sourceMap: ' + source.type + '.' + source.id)
    var sourceMap = scope.sourceMap
    sourceMap[source.type] = sourceMap[source.type] || {}
    sourceMap[source.type][source.id] = source
  }

  function finish() {
    if (source && source.id) addSource()
    cb()
  }

  var _source = _sources[source.type]
  if (!_source) return bail('Unknown source type')
  var worker = workers[source.type]
  normalize()
  var yesterday = util.now() - 1000*60*60*24
  var sourceMap = scope.sourceMap

  // No getter
  if (!(worker && worker.get)) {
    return finish()
  }

  // Validated within the last 24 hours
  if (source.data.validated && source.data.validated > yesterday) {
    return finish()
  }

  // Dupe
  if (sourceMap[source.type] && sourceMap[source.type][source.id]) {
    return finish()
  }

  // Get it
  worker.get(source, scope, function(err, validSource) {
    if (err) return bail(err)
    source = validSource
    finish()
  })
}
