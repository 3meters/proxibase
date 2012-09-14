/*
 * updateLink
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , log = util.log
  , async = require('async')
  , methods = require('./methods')
  , req
  , res
  , linkId
  , activityDate

module.exports.main = function(request, response) {
  req = request
  res = response
  activityDate = util.getTimeUTC()

  if (!(req.body && req.body.link)) {
    return res.sendErr(new HttpErr(httpErr.missingParam, 'link: object'))
  }

  if (!(req.body && req.body.originalToId)) {
    return res.sendErr(new HttpErr(httpErr.missingParam, 'originalToId: string'))
  }

  if (req.body.originalToId && typeof req.body.originalToId !== 'string') {
    return res.sendErr(new HttpErr(httpErr.badType, 'originalToId: string'))
  }

  doUpdateLink(req.body.link)
}

function doUpdateLink(link) {
  gdb.models['links'].findOne({_from: req.body.link._from, _to: req.body.originalToId}, function (err, doc) {
    if (err) return res.sendErr(err)
    if (!doc) return res.sendErr(new HttpErr(httpErr.notFound))

    doc.__user = req.user

    linkId = doc._id

    /* The mongoose model save logic will parse the toTableId from the id */
    doc._to = link._to

    doc.save(function(err, updatedDoc) {
      if (err) return res.sendErr(err)
      if (!updatedDoc) return res.sendErr(new HttpErr(httpErr.serverError))
      updateActivityDate()
    })
  })
}

function updateActivityDate() {
  /*
   * We need to update the activity date for the old parent
   * and the new parent.
   */
  if (!req.body.skipActivityDate) {
    /* Fire and forget */
    methods.propogateActivityDate(req.body.originalToId, activityDate)
    methods.propogateActivityDate(req.body.link._to, activityDate)
  }
  done()
}

function done() {
  res.send({
    info: 'Link updated',
    count: 1,
    data: {_id: linkId}
  })
}
