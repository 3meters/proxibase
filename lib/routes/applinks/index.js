/**
 * routes/applinks
 *    get proxibase applinks
 */

var workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
  yelp: require('./yelp'),
}

var apps = require('./apps').get()
var query = require('./query')
var refresh = require('./refresh')

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
    data: apps,
    date: util.now(),
    count: Object.keys(apps).length
  })
}

exports.refresh = refresh
exports.workers = workers
