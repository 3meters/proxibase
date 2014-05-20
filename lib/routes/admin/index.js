/*
 * routes/admin/index.js
 *
 *   Public admin methods: user must be admin to run
 */

var validate = require('./validate')

exports.addRoutes = function(app) {
  app.get('/admin', welcome)
  app.all('/admin/*', scrubReq)
  app.get('/admin/validate', validate)
}

function welcome(req, res) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      validate: true,
    }
  })
}

function scrubReq(req, res, next) {
  if (!req.asAdmin) return res.error(proxErr.badAuth())
  next()
}
