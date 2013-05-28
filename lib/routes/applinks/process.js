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

module.exports = function(ent, scope, cb) {

  if (!(ent && ent.applink)) return bail()

  var _applink = _applinks[ent.applink.type]
  if (!_applink) return bail('Unknown applink type')

  var originalEnt = util.clone(ent)

  var worker = workers[ent.applink.type]
  normalize()
  var applinkMap = scope.applinkMap

  // No getter
  if (!(worker && worker.get)) {
    return finish()
  }

  // Validated within the last period
  var fresh = util.now() - (1000 * 60)
  if (ent.applink.data.validated && ent.applink.data.validated > fresh) {
    return finish()
  }

  // Dupe
  if (applinkMap[ent.applink.type] && applinkMap[ent.applink.type][ent.applink.id]) {
    return finish()
  }

  // Call getter
  worker.get(ent, scope, function(err, validApplinkEnt) {
    if (err) return bail(err)
    ent = validApplinkEnt
    finish()
  })

  // Add the source and call back
  function finish() {
    if (ent && ent.applink && (ent.applink.id || ent.applink.url)) addEnt()
    cb()
  }

  // Normalize source id so they can be deduped
  function normalize() {
    if (ent.applink.id) ent.applink.id = String(ent.applink.id)
    if (ent.applink.url) ent.applink.url = String(ent.applink.url)
    ent.applink.data = ent.applink.data || {}
    if (worker && worker.normalize) { // type-specific normalizer
      worker.normalize(ent)
    }
  }

  // Add or overwrite applink entity in scope
  function addEnt() {
    var applinkMap = scope.applinkMap
    delete ent.applink.data.query
    applinkMap[ent.applink.type] = applinkMap[ent.applink.type] || {}
    // worker-specific dedupers belong here
    applinkMap[ent.applink.type][ent.applink.id] = applinkMap[ent.applink.type][ent.applink.id] || ent
  }

  // Log the best error we can and return
  function bail(err) {
    if (!type.isError(err)) {
      if (type.isString(err)) err = perr.badApplink(err)
      else err = perr.badApplink('', err)
    }
    err.entity = originalEnt
    logErr(err)
    cb()
  }
}
