/**
 * routes/sources
 *    get proxibase sources
 */

var util = require('util')
var log = util.log
var fs = require('fs')
var path = require('path')
var assetsDir = '../../assets'
var iconDir = '/img/sources/'
var sources = util.statics.sources
var suffix = '.png'

// Wire-up icon uris
function computeIconUris(sources) {
  for (var name in sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    sources[name].icon = util.config.service.uri_external + iconDir + filename + suffix
  }
}

exports.get = function(req, res) {
  res.send({
    data: sources,
    date: util.getTime(),
    count: sources.length,
    more: false
  })
}

exports.init = function(app) {
  computeIconUris(sources)
}

exports.addRoutes = function(app) {
  app.get('/sources', exports.get)
}


