/**
 * applinks/process.js
 *
 *   process a applink
 */

var _applinks = util.statics.applinks
var workers = require('./').workers

module.exports = function(applink, scope, cb) {

  // log('debug applink pushed to Q:', applink)

  if (!applink) return bail()

  var _applink = _applinks[applink.type]
  if (!_applink) return bail('Unknown applink type')

  var originalApplink = util.clone(applink)

  var worker = workers[applink.type]
  normalize()
  if (!applink) return bail('Could not normalize applink')

  var applinkMap = scope.applinkMap

  // No getter
  if (!(worker && worker.get)) {
    return finish()
  }

  // Validated within the last period
  var fresh = util.now() - (1000 * 60)
  if (!scope.refreshOnly
      && applink.data.validated
      && applink.data.validated > fresh) {
    return finish()
  }

  // Dupe
  if (applinkMap[applink.type] && applinkMap[applink.type][applink.appId]) {
    return finish()
  }

  // Call getter
  worker.get(applink, scope, function(err, validApplink) {
    if (err) return bail(err)
    applink = validApplink
    finish()
  })

  // Add the refreshed applink and call back
  function finish() {
    if (applink && (applink.appId || applink.appUrl)) addApplink()
    cb()
  }

  // Normalize source id so they can be deduped
  function normalize() {
    if (applink.appId) applink.appId = String(applink.appId)
    if (applink.appUrl) applink.appUrl = String(applink.appUrl)
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
    applinkMap[applink.type][applink.appId] = applinkMap[applink.type][applink.appId] || applink
  }

  // Log the best error we can and return
  function bail(err) {
    if (!tipe.isError(err)) {
      if (tipe.isString(err)) err = perr.badApplink(err)
      else err = perr.badApplink('', err)
    }
    err.message += '\napplink:\n' + util.inspect(originalApplink, false, 12)
    logErr(err)
    cb()
  }
}
