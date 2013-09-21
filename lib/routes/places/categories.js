/**
 * routes/categories
 *    get proxibase categories
 *    returns an array of arrays including icon links to category graphics
 */

var fs = require('fs')
var path = require('path')
var catDir = util.statics.assetsDir
//  static files computed by tools/categories/cats.js
var categories = require(path.join(catDir, 'categories.json'))
var catmap = require(path.join(catDir, 'catmap.json'))
var catmaps = {
  factual: require(path.join(catDir, 'catmap_factual.json')),
  foursquare: require(path.join(catDir, 'catmap_foursquare.json')),
  google: require(path.join(catDir, 'catmap_google.json')),
}


function get(req, res) {
  res.send({
    data: categories,
    date: util.getTime(),
    count: Object.keys(categories).length,
    more: false
  })
}

function getGeneric() {
  return {
    id: 'generic',
    name: '',
    photo: { prefix: 'generic_88.png', source: 'assets.categories' },
  }
}

function getCategory(id, providerName) {
  var catId = null
  if (!id) return null
  var provider = catmaps[providerName]
  if (!provider) return new Error ('Invalid call to getCategory')
  catId = provider[id]
  if (!catId) {
    logErr('Unknown ' + providerName + ' category id: ' + id)
    return null
  }
  return {
    id: catId,
    name: catmap[catId].name,
    photo: { prefix: catId + '_88.png', source: 'assets.categories' },
  }
}

exports.get = get
exports.getCategory = getCategory
exports.getGeneric = getGeneric
