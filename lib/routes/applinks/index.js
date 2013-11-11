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
  yelp: require('./yelp'),
}


var appMap = require('./appMap').get()
var query = require('./query')
var refresh = require('./refresh')
var applinkList = []

// Data router
exports.addRoutes = function (app) {
  app.get('/applinks', welcome)
  app.get('/applinks/refresh', refresh)
  app.post('/applinks/refresh', refresh)
  app.get('/applinks/suggest', query.suggest)
  app.post('/applinks/suggest', query.suggest)
}

function welcome(req, res) {
  res.send({
    data: appMap,
    date: util.now(),
    count: Object.keys(appMap).length
  })
}
