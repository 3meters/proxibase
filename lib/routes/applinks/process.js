/**
 * applinks/process.js
 *
 *   process a applink
 */

var apps = require('./').apps
var drivers = require('./').drivers

module.exports = function(applink, scope, cb) {

  if (!applink) return bail()

  var _applink = apps[applink.type]
  if (!_applink) return bail('Unknown applink type')

  if (applink.find) return drivers[applink.type].find(applink, scope, cb)

  var originalApplink = util.clone(applink)

  var driver = drivers[applink.type]
  applink = normalize(applink)

  if (!applink) return bail('Could not normalize applink')

  var candidateMap = scope.candidateMap

  // No getter
  if (!(driver && driver.get)) {
    return finish()
  }

  // See if dupe candidate in the queue already
  if (candidateMap[applink.type] && candidateMap[applink.type][applink.appId]) {
    return cb()  // Dupe in the queue already
  }
  else {
    if (applink.appId) {
      candidateMap[applink.type] = candidateMap[applink.type] || {}
      candidateMap[applink.type][applink.appId] = true
    }
  }

  // Validated within the last minute
  var fresh = util.now() - (1000 * 60)
  if (!scope.refreshOnly
      && !scope.forceRefresh
      && applink.validatedDate
      && applink.validatedDate > fresh) {
    if (scope.log) log('Skipping applink refresh due to refresh window', applink.appId)
    return finish()
  }

  // Call getter
  driver.get(applink, scope, function(err, validApplink) {
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
  function normalize(applink) {
    var err = scrub(applink, {
      appId:  {type: 'string'},
      appUrl: {type: 'string'},
      data:   {type: 'object', default: {}},
    })
    if (err) return null
    if (driver && driver.normalize) { // type-specific normalizer
      applink = driver.normalize(applink)
    }
    return applink
  }

  // Add or overwrite applink in scope
  function addApplink() {
    var applinkMap = scope.applinkMap
    delete applink.data.query
    applinkMap[applink.type] = applinkMap[applink.type] || {}
    // driver-specific dedupers belong here
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
