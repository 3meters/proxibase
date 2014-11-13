/**
 * /routes/places/index.js
 *
 * router for /place requests
 */

var near = require('./near')
var categories = require('./categories')
var photos = require('./photos')
var mergePlace = require('./merge')
var suggest = require('../suggest')


// Router
exports.addRoutes = function (app) {
  app.get('/places/?', welcome)
  app.get('/places/near/?', near.get)
  app.post('/places/near/?', near.get)
  app.get('/places/photos/?', photos.get)
  app.post('/places/photos/?', photos.get)
  app.get('/places/categories/?', categories.get)
  app.post('/places/categories/?', categories.get)
  app.get('/places/:placeId/applinks', getApplinks)
  app.get('/places/:placeId/?', getPlace)
  app.get('/places/:placeId/refresh', refreshPlace)
  app.get('/places/:placeId/merge/:place2Id', mergePlace)
  app.get('/places/suggest/?', suggest.main)   // backward compat, use /suggest/places
  app.post('/places/suggest/?', suggest.main)  // backward compat, use /suggest/places
}

function welcome(req, res) {
  var uri = util.config.service.uri + '/v1'
  var greeting = {
    methods: {
      near: uri + '/places/near',
      photos: uri + '/places/photos',
      categories: uri + '/places/categories',
    },
    docs: util.config.service.docsuri + '#places'
  }
  res.send(greeting)
}


function getApplinks(req, res) {
  res.redirect(req.apiVersionPrefix + '/applinks/place/' + req.params.placeId)
}


function getPlace(req, res) {
  db.places.safeFindOne(
    {_id: req.params.placeId},
    {links: {
      from: {applinks: 1},
      sort: [{position: 1}],
    }},
    function(err, result) {
      if (err) return res.error(err)
      res.send({data: result, count: (result) ? 1 : 0})
    }
  )
}


function refreshPlace(req, res) {
  var placeId = req.params.placeId
  var timeout = req.params.timeout || statics.timeout
  var user = req.user || util.anonUser
  db.places.refresh(placeId, user, timeout, function(err) {
    if (err) return res.error(err)
    res.redirect(req.apiVersionPrefix + '/places/' + placesId)
  })
}

exports.getNear = near.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
