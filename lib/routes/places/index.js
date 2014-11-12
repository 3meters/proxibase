/**
 * /routes/patches/index.js
 *
 * router for /patch requests
 */

var near = require('./near')
var categories = require('./categories')
var photos = require('./photos')
var mergePatch = require('./merge')
var suggest = require('../suggest')


// Router
exports.addRoutes = function (app) {
  app.get('/patches/?', welcome)
  app.get('/patches/near/?', near.get)
  app.post('/patches/near/?', near.get)
  app.get('/patches/photos/?', photos.get)
  app.post('/patches/photos/?', photos.get)
  app.get('/patches/categories/?', categories.get)
  app.post('/patches/categories/?', categories.get)
  app.get('/patches/:patchId/applinks', getApplinks)
  app.get('/patches/:patchId/?', getPatch)
  app.get('/patches/:patchId/refresh', refreshPatch)
  app.get('/patches/:patchId/merge/:patch2Id', mergePatch)
  app.get('/patches/suggest/?', suggest.main)   // backward compat, use /suggest/patches
  app.post('/patches/suggest/?', suggest.main)  // backward compat, use /suggest/patches
}

function welcome(req, res) {
  var uri = util.config.service.uri + '/v1'
  var greeting = {
    methods: {
      near: uri + '/patches/near',
      photos: uri + '/patches/photos',
      categories: uri + '/patches/categories',
    },
    docs: util.config.service.docsuri + '#patches'
  }
  res.send(greeting)
}


function getApplinks(req, res) {
  res.redirect(req.apiVersionPrefix + '/applinks/patch/' + req.params.patchId)
}


function getPatch(req, res) {
  db.patches.safeFindOne(
    {_id: req.params.patchId},
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


function refreshPatch(req, res) {
  var patchId = req.params.patchId
  var timeout = req.params.timeout || statics.timeout
  var user = req.user || util.anonUser
  db.patches.refresh(patchId, user, timeout, function(err) {
    if (err) return res.error(err)
    res.redirect(req.apiVersionPrefix + '/patches/' + patchId)
  })
}

exports.getNear = near.get
exports.getCategories = categories.get
exports.getPhotos = photos.get
