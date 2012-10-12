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

  req.c = db.collection(req.cName)
  delete req.body.table
  delete req.body.collection

  // graft properties passed in on the query string to the body
  // notibly user and session
  for (key in req.query) {
    req.body[key] = req.query[key]
  }

  // then replace the query object with the post body
  req.query = req.body

  // run it
  dataService.find(req, res)
}

