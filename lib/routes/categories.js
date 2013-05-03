/**
 * routes/categories
 *    get proxibase categories
 *    returns an array of arrays including icon links to category graphics
 */

var fs = require('fs')
var cats = require('../../assets/categories.json')  // computed by tools/categories/cats

// Icon uris are relative to the server, compute on init
function computeIconUris(cats) {
  cats.forEach(function(cat) {
    if (cat.categories && cat.categories.length) computeIconUris(cat.categories)
    cat.icon = '/img/categories/' + cat.id + '_88.png'
  })
}

function get(req, res) {
  res.send({
    data: cats,
    date: util.getTime(),
    count: cats.length,
    more: false
  })
}

exports.init = function(app) {
  computeIconUris(cats)
}

exports.addRoutes = function(app) {
  app.get('/categories', get)
}
