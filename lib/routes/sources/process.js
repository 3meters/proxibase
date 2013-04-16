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

  // Basic type-checking and normalization
  var _source = _sources[source.type]
  if (!_source) return bail(source, 'Unknown source type')

  if (!(source.id || source.url)) {
    return bail('source id or url is required')
  }

  if (source.id) source.id = String(source.id)
  if (source.url) source.url = String(source.url)
  source.data = source.data || {}

  // Call custom normalizer
  var worker = workers[source.type]
  if (worker && worker.normalize) {
    worker.normalize(source)
  }

  if (!(source && source.id)) return bail()

  // If no custom getter we are done
  if (!(worker && worker.get)) {
    add(source, scope)
    return cb()
  }

  // Call the source, validate it, and grovel it for more sources
  worker.get(source, scope, function(err, validatedSource) {
    if (err) return bail(err)
    add(validatedSource, scope)
    log('debug worked called-back process, scope: ', scope)
    cb()
  })
}

// Add or overwrite source in scope
function add(source, scope) {
  log('debug process adding to source to sourceMap', source)
  var sourceMap = scope.sourceMap
  sourceMap[source.type] = sourceMap[source.type] || {}
  sourceMap[source.type][source.id] = source
  log('sourceMap:', scope.sourceMap)
}
