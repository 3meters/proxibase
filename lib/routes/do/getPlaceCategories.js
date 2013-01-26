/*
 * getPlaceCategories
 */

var util = require('util')
var log = util.log
var fs = require('fs')
var cats = require('../../../assets/categories.json')  // computed by tools/categories/cats


// Run on module load
;(function() { computeIconUris(cats) })()

// Request body template
var _body = {}

exports.main = function(req, res) {

  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)

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
