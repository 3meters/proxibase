/**
 * routes/applinks
 *    get proxibase applinks
 */

exports.workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
}


var _applinks = util.statics.applinks
var query = require('./query')
var applinkList = []

// Data router
exports.addRoutes = function (app) {
  app.get('/applinks', welcome)
  app.get('/applinks/refresh', query.refresh)
  app.post('/applinks/refresh', query.refresh)
  app.get('/applinks/suggest', query.suggest)
  app.post('/applinks/suggest', query.suggest)
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
