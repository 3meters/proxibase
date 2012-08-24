/*
 * API: admin/main.js  Public admin methods
 *   User must be admin to run
 */

var
  findOrphans = require('./integrity').findOrphans
  util = require('../../util'),
  log = util.log

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


