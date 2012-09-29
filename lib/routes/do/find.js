/**
 * routes/do/find.js
 *
 * Same as a /data get but with params in the body
 */


var util = require('util')
  , gdb = util.gdb
  , db = util.db
  , dataService = require('../data')


module.exports = function(req, res) {

  if (!(req.body.collection || req.body.table)) {
    return res.error(new HttpErr(httpErr.missingParam, 'collection'))
  }
  req.cName = req.body.collection || req.body.table // backward compat
  if (!db.cNames[req.cName]) {
    return res.error(new HttpErr(httpErr.badValue, req.cName))
  }
  req.query = {}
  delete req.body.table
  delete req.body.collection

  for (key in req.body) {
    var err = setProp(key, req.body[key])
    if (err) return res.error(err)
  }

  function setProp(key, val) {
    var props = {
      ids: function(val) {
        if (val instanceof Array)
          req.query.ids = val
        else return new HttpErr(httpErr.badType, 'ids: array')
      },
      names: function(val) {
        if (val instanceof Array) 
          req.query.names = val
        else return new HttpErr(httpErr.badType, 'names: array')
      },
      find: function(val) {
        req.query.find = val
      },
      fields: function(val) {
        if (val instanceof Array)
          req.query.fields = val
        else return new HttpErr(httpErr.badType, 'fields: array')
      },
      sort: function(val) {
        req.query.sort = val
      },
      count: function(val) {
        req.query.count = val
      },
      skip: function(val) {
        req.query.skip = val
      },
      lookups: function(val) {
        if (typeof val === 'boolean')
          req.query.lookups = val
        else return new HttpErr(httpErr.badType, 'lookups: boolean')
      },
      limit: function(val) {
        if (typeof val === 'number' && val === parseInt(val) && val > 0)
          req.query.limit = val
        else return new HttpErr(httpErr.badValue, 'limit')
      },
      children: function(val) {
        if (val instanceof Array)
          req.query.children = val
        else return new HttpErr(httpErr.badType, 'children: array')
      },
      // user and session params are handled by middleware upstream
      user: function(val) { },
      session: function(val) { }
    }
    if (!props[key]) return new HttpErr(httpErr.badParam, key)
    return props[key](val)
  }

  // run it
  dataService.find(req, res)
}


