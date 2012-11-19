/*
 * logAction
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , methods = require('./methods')

module.exports.main = function(req, res) {
  req.activityDate = util.getTimeUTC()

  /* id per source */
  if (!(req.body.targetId && typeof req.body.targetId === 'string')) {
    return res.error(proxErr.missingParam('targetId type string'))
  }

  /* aircandi, foursquare */
  if (!(req.body.targetSource && typeof req.body.targetSource === 'string')) {
    return res.error(proxErr.missingParam('targetSource type string'))
  }

  /* tune, tune_custom_first, tune_synthetic_first, browse */
  if (!(req.body.actionType && typeof req.body.actionType === 'string')) {
    return res.error(proxErr.missingParam('actionType type string'))
  }

  doLogAction(req, res)
}

function doLogAction(req, res) {
  /* 
   * Save action, returns immediately and any error is logged
   */
  var action = {_target:req.body.targetId, targetSource:req.body.targetSource, type:req.body.actionType}
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
    done(req, res)
  })
}

function done(req, res) {
  res.send({
    info: 'Action logged',
    count: 1,
    data: {_target: req.body.targetId}
  })
}

