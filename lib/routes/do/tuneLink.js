/*
 * tuneLink
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')

module.exports.main = function(req, res) {
  req.activityDate = util.getTimeUTC()

  if (!(req.body && req.body.linkId)) {
    return res.error(proxErr.missingParam('link id required'))
  }

  doTuneLink(req.body.linkId, req, res)
}

function doTuneLink(linkId, req, res) {

  gdb.models.links.findOne({_id: linkId}, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(proxErr.notFound())

    /* Tuning requires a valid user */  
    doc.__user = req.user

    if (doc.plus) {
      doc.plus++
    }
    else {
      doc.plus = 1
    }

    doc.save(function(err, updatedDoc) {
      if (err) return res.error(err)
      if (!updatedDoc) return res.error(proxErr.serverError())

      /* Save action record */
      methods.logAction(updatedDoc._id, 'aircandi', 'tune', req)

      done(req, res)
    })
  })
}

function done(req, res) {
  res.send({
    info: 'Link updated',
    count: 1,
    data: {_id: req.linkId}
  })
}

function logAction(target, targetSource, type, req) {
  /* 
   * Save action, returns immediately and any error is logged
   */
  var action = {_target:target, targetSource:targetSource, type:type}
  var doc = new gdb.models.actions(action)
  doc.__asAdmin = true
  if (req.user) {
    doc.__user = req.user
  }
  else {
    // Ok for this to be performed annonymously
    doc.__user = util.adminUser
  }
  doc.save(function (err, savedDoc) {
    if (err) log('Error inserting action: ' + err)
  })
  return
}
