/*
 * updateLink
 */

var
  gdb = require('../main').gdb,   // mongodb connection object
  db = require('../main').db,     // mongoskin connection object
  log = require('../util').log,
  async = require('async'),  
  methods = require('./methods'),
  util = require('../util'),  
  req,
  res,
  linkId,
  activityDate

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
  gdb.models['links'].findOne({ _to: req.body.originalToId, _from: req.body.link._from}, function (err, doc) {
    if (err) return res.sendErr(err, 500)
    if (!doc) return res.sendErr(new HttpErr(httpErr.notFound))

    linkId = doc._id

    /* The mongoose model save logic will parse the toTableId from the id */
    doc._to = link._to

    doc.save(function(err, updatedDoc) {
      if (err) return res.sendErr(err, 500)
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
