/**
 * /routes/patches/index.js
 *
 * router for /patch requests
 */

var near = require('./near')
var categories = require('./categories')

// Router
exports.addRoutes = function (app) {
  app.get('/patches/?', welcome)
  app.get('/patches/near/?', near.get)
  app.post('/patches/near/?', near.get)
  app.get('/patches/categories/?', categories.get)
  app.post('/patches/categories/?', categories.get)
}

function welcome(req, res) {
  var uri = util.config.service.uri + '/v1'
  var greeting = {
    methods: {
      near: uri + '/patches/near',
      categories: uri + '/patches/categories',
    },
    docs: util.config.service.docsuri + '#patches'
  }
  res.send(greeting)
}

exports.getNear = near.get
exports.getCategories = categories.get
