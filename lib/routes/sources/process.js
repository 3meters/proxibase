/**
 * process a source
 */

var _sources = util.statics.sources
var workers = {
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  webpage: require('./webpage'),
  foursquare: require('/foursquare'),
  factual: require('./factual'),
}

module.exports = function(source, scope, cb) {

  var _source = _sources[source.type]
  if (!_source) return bail(source, 'Unknown source type')

  var worker = workers[source.type]

  normalize()

  if (!worker) return finish()

  worker.validate(source, scope, function(err) {
    if (err) return bail(err)
    worker.inspect(source, scope, sourceQ)  // fire and forget
    finish()
  })

  function normalize() {
    if (!(source.id || source.url)) {
      return bail('source id or url is required')
    }

    if (source.id) source.id = String(source.id)
    if (source.url) source.url = String(source.url)
    if (_source && _source.system) source.system = true  // hide at client
    source.data = source.data || {}

    if (worker && worker.normalize) {
      worker.normalize(source)
    }
    if (!source && source.id) return bail()
  }

  // Log an error and return null
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

  function finish() {
    var sourceMap = scope.sourceMap
    sourceMap[source.type] = sourceMap[source.type] || {}
    if (!sourceMap[source.type][source.id]) {
      // We have a new source
      sourceMap[source.type][source.id] = source
      scope.sources.push(source)
    }
    cb()
  }
}
