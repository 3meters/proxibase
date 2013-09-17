/**
 * /routes/places/index.js
 *
 * router for /place requests
 */

var nearLocation = require('./nearLocation')
var categories = require('./categories')
var photos = require('./photos')

// Data router
exports.addRoutes = function (app) {
  app.get('/places/?', welcome)
  app.get('/places/nearLocation/?', nearLocation.get)
  app.post('/places/nearLocation/?', nearLocation.get)
  app.get('/places/photos/?', photos.get)
  app.post('/places/photos/?', photos.get)
  app.get('/places/categories/?', categories.get)
  app.post('/places/categories/?', categories.get)
}

function welcome(req, res) {
  var url = util.config.service.url
  var greeting = {
    methods: {
      nearLocation: url + '/places/nearLocation',
      photos: url + '/places/photos',
      categories: url + '/places/categories',
    },
    docs: util.config.service.docsUrl + '#places'
  }
  res.send(greeting)
}

exports.init = function() {
  categories.init()
}

exports.getNearLocation = nearLocation.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
