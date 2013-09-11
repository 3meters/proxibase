/**
 * routes/categories
 *    get proxibase categories
 *    returns an array of arrays including icon links to category graphics
 */

var fs = require('fs')
var path = require('path')
var catDir = util.statics.assetsDir
//  static files computed by tools/categories
var cats = require(path.join(catDir, 'categories.json'))
var catMaps = {
  factual: require(path.join(catDir, 'cat_map_factual.json')),
  foursquare: require(path.join(catDir, 'cat_map_foursquare.json')),
  google: require(path.join(catDir, 'cat_map_google.json')),
}

log('cats', cats)
log('catMaps: ', catMaps)

// Icon uris are relative to the server, compute on init
function computeIconUris(cats) {
  cats.forEach(function(cat) {
    if (cat.categories && cat.categories.length) computeIconUris(cat.categories)
        cat.photo = { source: 'assets.categories', prefix:'/img/categories/' + cat.id + '_88.png' }
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

exports.get = get
exports.cats = cats
exports.catMaps = catMaps
