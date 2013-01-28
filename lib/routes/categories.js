/*
 * routes/categories
 *    get proxibase categories
 *    returns and array of arrays including icon links to category graphics
 */

var util = require('util')
var log = util.log
var fs = require('fs')
var cats = require('../../assets/categories.json')  // computed by tools/categories/cats


// Run on module load
;(function() { computeIconUris(cats) })()


exports.addRoutes = function(app) {
  app.get('/categories', getCategories)
}

function getCategories(req, res) {

  res.send({
    data: cats,
    date: util.getTime(),
    count: cats.length,
    more: false
  })
}

// The icon uris are relative to the server, compute once on server startup
function computeIconUris(cats) {
  cats.forEach(function(cat) {
    if (cat.categories && cat.categories.length) computeIconUris(cat.categories)
    cat.icon = util.config.service.uri_external + '/img/categories/' +
        cat.id + '_88.png'
  })
}
