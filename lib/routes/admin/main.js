/*
 * routes/admin/main.js
 *
 *   Public admin methods: user must be admin to run
 */

var util = require('util')
  , log = util.log
  , findOrphans = require('./integrity').findOrphans
  , rankUsers = require('./stats').rankUsers


module.exports = function(app) {
  app.get('/admin/?', welcome)
  app.all('/admin/*', scrub)
  app.get('/admin/findOrphans', findOrphans)
  app.get('/admin/rankUsers', rankUsers)
}

function welcome(req, res, next) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      findOrphans: true,
      rankUsers: true
    }
  })
}

function scrub(req, res, next) {
  if (!(req.user && req.user.role && req.user.role === 'admin')) {
    return res.error(httpErr.badAuth)
  }
}



