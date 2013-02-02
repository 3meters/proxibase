/*
 * routes/admin/index.js
 *
 *   Public admin methods: user must be admin to run
 */

var findOrphans = require('./integrity').findOrphans
var clientVersion = require('./integrity')

exports.addRoutes = function(app) {
  app.get('/admin/?', welcome)
  app.all('/admin/*', scrub)
  app.get('/admin/findOrphans', findOrphans)
}

function welcome(req, res, next) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      findOrphans: true,
    }
  })
}

function scrub(req, res, next) {
  if (!req.asAdmin) return res.error(proxErr.badAuth())
  next()
}
