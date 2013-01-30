/**
 * routes/sources
 *    get proxibase sources
 */

var util = require('util')
var log = util.log
var sources = util.statics.sources


function get(req, res) {
  res.send({
    data: sources,
    date: util.getTime(),
    count: sources.length,
    more: false
  })
}

exports.addRoutes = function(app) {
  app.get('/sources', get)
}
