/**
 * routes/applinks
 *    get proxibase applinks
 */

var _applinks = util.statics.applinks
var suggest = require('./suggest')
var applinkList = []

// Data router
exports.addRoutes = function (app) {
  app.get('/applinks', welcome)
  app.get('/applinks/suggest', suggest.main)
  app.post('/applinks/suggest', suggest.main)
}

function welcome(req, res) {
  res.send({
    data: applinkList,
    date: util.now(),
    count: applinkList.length,
    more: false
  })
}

// Convert applinks map into ordered array
function init() {
  var keys = Object.keys(_applinks)
  keys.sort(function(a, b) {
    return _applinks[a].sortOrder - _applinks[b].sortOrder
  })
  keys.forEach(function(key) {
    var applink = { type: key }
    _.extend(applink, _applinks[key].props)
    applinkList.push(applink)
  })
}

exports.init = init
