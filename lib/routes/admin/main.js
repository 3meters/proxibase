/*
 * routes/admin/main.js
 *
 *   Public admin methods: user must be admin to run
 */

var util = require('util')
  , log = util.log
  , findOrphans = require('./integrity').findOrphans


module.exports.app = function(req, res, next) {

  var methods = {
    findorphans: findOrphans
  }

  if (!(req.params && req.params && req.params.method &&
        methods[req.params.method])) {
    return res.error(httpErr.notFound)
  }

  if (!(req.user && req.user.role && req.user.role === 'admin')) {
    return res.error(httpErr.badAuth)
  }

  methods[req.params.method](req, res, next)
}


