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

  var qry = mdb.models['users']
    .find({ email: req.body.userEmail })
    .fields(['_id'])

  qry.run(function(err, users) {
    if (err) return sendErr(res, err)
    if (!users.length) return sendErr(res, 404)
    return getEntIds(req, res, users[0]._id)
  })
}

function getEntIds(req, res, userId) {

  var qry = mdb.models['entities']
    .find({ _creator: userId })
    .fields('_id')

  qry.run(function(err, entIds) {
    if (err) return sendErr(res, err)
    if (!entIds.length) return sendErr(res, 404)
    for (var i = entIds.length; i--;) {
      entIds[i] = entIds[i]._id // convert objects to strings
    }
    req.body.entityIds = entIds
    return getEntities(req, res)
  })
}

