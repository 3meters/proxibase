/*
 * getEntitiesForUser
 */

var
  mdb = require('../main').mdb,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEntities').main

exports.main = function(req, res) {

  if (!(req.body && req.body.userEmail))
    return sendErr(res, new Error("request.body.userEmail is required"))
  var email = req.body.userEmail.toLowerCase()

  var qry = mdb.models['users']
    .find({ email: email })
    .fields(['_id'])

  qry.run(function(err, users) {
    if (err) return sendErr(res, err)
    var userId = users[0] ? users[0]._id : null
    return getEntIds(req, res, userId)
  })
}

function getEntIds(req, res, userId) {

  var qry = mdb.models['entities']
    .find({ _creator: userId })
    .where('_entity').equals(null)
    .where('enabled').equals(true)
    .where('root').equals(true)
    .fields('_id')

  qry.run(function(err, entIds) {
    if (err) return sendErr(res, err)
    for (var i = entIds.length; i--;) {
      entIds[i] = entIds[i]._id // convert objects to strings
    }
    req.body.entityIds = entIds
    req.body.getChildren = true
    return getEntities(req, res)
  })
}

