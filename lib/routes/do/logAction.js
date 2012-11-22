/*
 * logAction
 */

var util = require('util')
var db = util.db
var log = util.log
var methods = require('./methods')

module.exports.main = function(req, res) {
  req.activityDate = util.getTimeUTC()

  /* id per source */
  if (!(req.body.targetId && typeof req.body.targetId === 'string')) {
    return res.error(proxErr.missingParam('targetId type string required'))
  }

  /* 
   * action records are always owned/created by the system so userId
   * identifies the user involved 
   */
  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.error(proxErr.missingParam('userId type string required'))
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
  methods.logAction(req.body.targetId, req.body.targetSource, req.body.actionType, req.body.userId, req)
  done(req, res)
}

function done(req, res) {
  res.send({
    info: 'Action logged',
    count: 1,
    data: {_target: req.body.targetId}
  })
}

