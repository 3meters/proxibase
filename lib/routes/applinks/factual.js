/**
 * applinks/factual.js
 *
 *  Query factual
 */

var apps = require('./').apps
var async = require('async')

function get(applink, scope, cb) {

  if (scope.refreshOnly) return cb(null, null) // paranoid

  if (!applink) return perr.badApplink(applink)

  if (applink.appId) {
    // We already have a factual Id, skip directly to crosswalk
    return getCrosswalk(applink, scope, cb)
  }

  if (!(applink.data && applink.data.query)) return cb()

  var query = applink.data.query
  if (!(query.namespace && query.namespace_id)) return cb()

  var search = {
    path: '/t/crosswalk',
    query: {filters: query},
    timeout: scope.timeout,
    log: scope.log,
  }

  // Get the factual Id of a non-factual applink
  util.callService.factual(search, function(err, res) {
    if (err) return cb(perr.partnerError('Factual', err))
    if (!(res.body && res.body.data && res.body.data.length)) return cb()
    var factualId = res.body.data[0].factual_id
    if (!factualId) return cb(perr.badApplink('Missing factual_id'))
    applink.appId = factualId
    getCrosswalk(applink, scope, cb)
  })
}


function getCrosswalk(applink, scope, cb) {

  var raw = scope.raw
  var query = applink.query
  var search = {
    path: '/t/crosswalk',
    query: {filters: {factual_id: applink.appId}, limit: 50},
    log: scope.log,
    timeout: scope.timeout,
  }

  util.callService.factual(search, function(err, res, body) {
    if (err) return cb(err)
    var results = body.data
    if (!(results && results.length)) {
      return cb(perr.badApplink('No results from factual'))
    }

    if (scope.raw) scope.raw.factualCandidates = results

    // Detect spurious Factual place merge by the presense of two or
    // more foursquare Ids that foursquare doesn't resolve the same place
    var foursquareIds = []
    results.forEach(function(result) {
      if (('foursquare' === result.namespace) && result.namespace_id) {
        foursquareIds.push(result.namespace_id)
      }
    })

    if (foursquareIds.length <= 1) addCrosswalkLinks()
    else {
      validatedFoursquareIdMap = {}
      async.each(foursquareIds, callFoursquare, finish)

      function callFoursquare(fsId, next) {
        util.callService.foursquare({
          path: fsId
        }, function(err, res, body) {
          try { validatedFoursquareIdMap[body.response.venue.id] = true }
          catch (e) {}
          return next()
        })
      }

      function finish(err) {
        var validatedFoursquareIds = Object.keys(validatedFoursquareIdMap)
        if (validatedFoursquareIds.length <= 1) return addCrosswalkLinks()
        else {
          var corpse = {
            factualId: applink.appId,
            foursquareIds: validatedFoursquareIds
          }
          if (!scope.log) logErr('Factual possible mis-merge', corpse)
          return cb(perr.partnerError('Factual possible mis-merge', corpse))
        }
      }
    }

    function addCrosswalkLinks() {
      results.forEach(function(result) {
        if (apps[result.namespace]) {
          scope.applinkQ.push({
            type: result.namespace,
            appId: result.namespace_id,
            appUrl: result.url,
            origin: 'factual',
            originId: result.namespace + '.' + applink.appId,
          })
        }
      })
      cb(null, null) // we don't return or persist factual applinks
    }
  })
}

exports.get = get
