/**
 * routes/categories
 *    get proxibase categories
 *    returns an array of arrays including icon links to category graphics
 */

var path = require('path')
var catDir = statics.assetsDir
var categories = require(path.join(catDir, 'categories_patch.json'))

function get(req, res) {
  res.send({
    data: categories,
    date: util.getTime(),
    count: Object.keys(categories).length,
    more: false
  })
}

exports.get = get