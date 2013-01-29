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
var suffix = '.png'
var _sources = util.statics.sources
var sources = []

// Wire-up icon uris
function computeIconUris() {
  for (var name in _sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    _sources[name].icon = util.config.service.uri_external + iconDir + filename + suffix
  }
}

// Convert sources map into ordered array sans system properties
function makeSourceArray() {
  var keys = Object.keys(_sources)
  keys.sort(function(a, b) {
    return _sources[a]._sortOrder - _sources[b]._sortOrder
  })
  keys.forEach(function(key) {
    var source = {source: key}
    for (var sKey in _sources[key]) {
      if (sKey.indexOf('_') !== 0) source[sKey] = _sources[key][sKey]
    }
    sources.push(source)
  })
}

function get(req, res) {
  res.send({
    data: sources,
    date: util.getTime(),
    count: sources.length,
    more: false
  })
}

exports.init = function(app) {
  computeIconUris()
  makeSourceArray()
}

exports.addRoutes = function(app) {
  app.get('/sources', get)
}
