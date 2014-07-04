/**
 * /routes/places/index.js
 *
 * router for /place requests
 */

var near = require('./near')
var suggest = require('./suggest')
var categories = require('./categories')
var photos = require('./photos')
var mergePlace = require('./merge')


// Data router
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
  app.get('/places/suggest', suggest.main)
  app.post('/places/suggest', suggest.main)
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


function getApplinks(req, res) {
  res.redirect('/v' + req.apiVersion + '/applinks/place/' + req.params.placeId)
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
    res.redirect('/v1/places/' + placeId)   // TODO:  accomplish the same thing without hardcoding '/v1'
  })
}

exports.getNear = near.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
