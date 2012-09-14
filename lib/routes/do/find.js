/**
 * routes/do/find.js
 *
 * Same as a /data get but with params in the body
 */


var util = require('util')
  , gdb = util.gdb
  , dataService = require('../data')


module.exports = function(req, res) {

  if (!req.body.table) {
    return res.error(new HttpErr(httpErr.missingParam, 'tableName'))
  }
  if (!gdb.models[req.body.table]) {
    return res.error(new HttpErr(httpErr.badValue, req.body.table))
  }
  req.modelName = req.body.table
  req.model = gdb.models[req.modelName]
  req.qry = {}
  delete req.body.table

  for (key in req.body) {
    var err = setProp(key, req.body[key])
    if (err) return res.error(err)
  }

  function setProp(key, val) {
    var props = {
      ids: function(val) {
        if (val instanceof Array) 
          req.qry.ids = val
        else return new HttpErr(httpErr.badType, 'ids: array')
      },
      names: function(val) {
        if (val instanceof Array) 
          req.qry.names = val
        else return new HttpErr(httpErr.badType, 'names: array')
      },
      find: function(val) {
        req.qry.find = val
      },
      fields: function(val) {
        if (val instanceof Array)
          req.qry.fields = val
        else return new HttpErr(httpErr.badType, 'fields: array')
      },
      sort: function(val) {
        req.qry.sort = val
      },
      count: function(val) {
        req.qry.count = val
      },
      skip: function(val) {
        req.qry.skip = val
      },
      lookups: function(val) {
        if (typeof val === 'boolean')
          req.qry.lookups = val
        else return new HttpErr(httpErr.badType, 'lookups: boolean')
      },
      limit: function(val) {
        if (typeof val === 'number' && val === parseInt(val) && val > 0)
          req.qry.limit = val
        else return new HttpErr(httpErr.badValue, 'limit')
      },
      children: function(val) {
        if (val instanceof Array)
          req.qry.children = val
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
  return dataService.get(req, res)
}


