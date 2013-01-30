/**
 * routes/sources
 *    get proxibase sources
 */

var util = require('util')
var log = util.log
var _sources = util.statics.sources
var sources = []

// Convert sources map into ordered array
function init() {
  var keys = Object.keys(_sources)
  keys.sort(function(a, b) {
    return _sources[a].sortOrder - _sources[b].sortOrder
  })
  keys.forEach(function(key) {
    var source = {source: key}
    util.extend(source, _sources[key].statics)
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

exports.init = init

exports.addRoutes = function(app) {
  app.get('/sources', get)
}
