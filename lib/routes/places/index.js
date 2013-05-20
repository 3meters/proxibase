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
  app.get('/places/getNearLocation/?', nearLocation.get)
  app.post('/places/getNearLocation/?', nearLocation.get)
  app.get('/places/getPhotos/?', photos.get)
  app.post('/places/getPhotos/?', photos.get)
  app.get('/places/getCategories/?', categories.get)
  app.get('/categories/?', categories.get)   // Deprecated
}

exports.init = function() {
  categories.init()
}

exports.getNearLocation = nearLocation.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
