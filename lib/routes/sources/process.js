/**
 * sources/process.js
 *
 *   process a source
 */
var _sources = util.statics.sources
var workers = {
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  webpage: require('./webpage'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
}

module.exports = function(source, scope, cb) {

  // Log the best error we can and return
  function bail() {
    if (!type.isError(err)) {
      if (type.isString(err)) err = perr.badSource(err)
      else err = perr.badSource('', err)
    }
    logErr(err.message, source)
    if (err.info) logErr(err.info)
    if (err.stack) logErr(util.appStack(err.stack))
    cb()
  }

  var _source = _sources[source.type]
  if (!_source) return bail(source, 'Unknown source type')

  if (!(source.id || source.url)) {
    return bail('source id or url is required')
  }

  source.id = String(source.id)
  source.url = String(source.url)
  source.data = source.data || {}

  // Call custom normalizer
  var worker = workers[source.type]
  if (worker && worker.normalize) {
    worker.normalize(source)
  }

  if (!(source && source.id)) return bail()

  // If no custom validator we are done
  if (!(worker && worker.validate)) {
    add(source, scope)
    return cb()
  }

  // Call the source, validate it, and grovel it for more sources
  worker.inspect(source, scope, function(err, inspectedSource) {
    if (err) return bail(err)
    add(inspectedSource, scope)
    cb()
  })
}

// Add or overwrite source in scope
function add(source, scope) {
  var sourceMap = scope.sourceMap
  sourceMap[source.type] = sourceMap[source.type] || {}
  sourceMap[source.type][source.id] = source
}
