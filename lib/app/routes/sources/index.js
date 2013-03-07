/**
 * routes/sources
 *    get proxibase sources
 */

var _sources = util.statics.sources
var suggest = require('./suggest')
var sourceList = []

// Data router
exports.addRoutes = function (app) {
  app.get('/sources', welcome)
  app.get('/sources/suggest', suggest.main)
  app.post('/sources/suggest', suggest.main)
}

function welcome(req, res) {
  res.send({
    data: sourceList,
    date: util.now(),
    count: sourceList.length,
    more: false
  })
}

// Convert sources map into ordered array
function init() {
  var keys = Object.keys(_sources)
  keys.sort(function(a, b) {
    return _sources[a].sortOrder - _sources[b].sortOrder
  })
  keys.forEach(function(key) {
    var source = { type: key }
    _.extend(source, _sources[key].props)
    sourceList.push(source)
  })
}

exports.init = init
