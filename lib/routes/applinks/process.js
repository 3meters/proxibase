/**
 * applinks/process.js
 *
 *   process a applink
 */
var _applinks = util.statics.applinks

var workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
}

module.exports = function(applink, scope, cb) {

  log('debug applink pushed to Q:', applink)

  if (!applink) return bail()

  var _applink = _applinks[applink.type]
  if (!_applink) return bail('Unknown applink type')

  var originalApplink = util.clone(applink)

  var worker = workers[applink.type]
  normalize()
  var applinkMap = scope.applinkMap

  // No getter
  if (!(worker && worker.get)) {
    return finish()
  }

  // Validated within the last period
  var fresh = util.now() - (1000 * 60)
  if (applink.data.validated && applink.data.validated > fresh) {
    return finish()
  }

  // Dupe
  if (applinkMap[applink.type] && applinkMap[applink.type][applink.id]) {
    return finish()
  }

  // Call getter
  worker.get(applink, scope, function(err, validApplink) {
    if (err) return bail(err)
    applink = validApplink
    finish()
  })

  // Add the source and call back
  function finish() {
    if (applink && (applink.id || applink.url)) addApplink()
    cb()
  }

  // Normalize source id so they can be deduped
  function normalize() {
    if (applink.id) applink.id = String(applink.id)
    if (applink.url) applink.url = String(applink.url)
    applink.data = applink.data || {}
    if (worker && worker.normalize) { // type-specific normalizer
      worker.normalize(applink)
    }
  }

  // Add or overwrite applink in scope
  function addApplink() {
    var applinkMap = scope.applinkMap
    delete applink.data.query
    applinkMap[applink.type] = applinkMap[applink.type] || {}
    // worker-specific dedupers belong here
    applinkMap[applink.type][applink.id] = applinkMap[applink.type][applink.id] || applink
  }

  // Log the best error we can and return
  function bail(err) {
    if (!tipe.isError(err)) {
      if (tipe.isString(err)) err = perr.badApplink(err)
      else err = perr.badApplink('', err)
    }
    err.message += '\napplink:\n' + util.inspect(originalApplink, 12)
    logErr(err)
    cb()
  }
}
