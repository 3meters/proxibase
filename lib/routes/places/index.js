/**
 * /routes/places/index.js
 *
 * router for /place requests
 */

var near = require('./near')
var categories = require('./categories')
var photos = require('./photos')

// Data router
exports.addRoutes = function (app) {
  app.get('/places/?', welcome)
  app.get('/places/near/?', near.get)
  app.post('/places/near/?', near.get)
  app.get('/places/photos/?', photos.get)
  app.post('/places/photos/?', photos.get)
  app.get('/places/categories/?', categories.get)
  app.post('/places/categories/?', categories.get)
}

function welcome(req, res) {
  var url = util.config.service.url
  var greeting = {
    methods: {
      near: url + '/places/near',
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

exports.getNear = near.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
