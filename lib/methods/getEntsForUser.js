/*
 * getEntitiesForUser
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEnts').main

exports.main = function(req, res) {

  if (!(req.body && req.body.userEmail))
    return sendErr(res, new Error("request.body.userEmail is required"))

  if (typeof req.body.getChildren === 'boolean')
    var getChildren = req.body.getChildren

  var qry = mdb.models['users']
    .find({ email: req.body.userEmail })
    .fields(['_id'])

  qry.run(function(err, userDocs) {
    log('userDocs', userDocs)
    if (err) return sendErr(res, err)
    if (!(userDocs && userDocs.length)) return sendErr(res, 404)
    req.body = { entityIds: userDocs }
    if (getChildren) req.body.getChildren = getChildren
    return getEntities(req, res)
  })
}

