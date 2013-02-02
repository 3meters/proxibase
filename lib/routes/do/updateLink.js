/*
 * updateLink
 */

var db = util.db
var methods = require('./methods')


module.exports.main = function(req, res) {

  var activityDate = util.getTimeUTC()
  var linkId

  if (!(req.body && req.body.link)) {
    return res.error(proxErr.missingParam('link: object'))
  }

  if (!(req.body && req.body.originalToId)) {
    return res.error(proxErr.missingParam('originalToId: string'))
  }

  if (req.body.originalToId && typeof req.body.originalToId !== 'string') {
    return res.error(proxErr.badType('originalToId: string'))
  }

  doUpdateLink(req.body.link, req, res)

  function doUpdateLink(link, req, res) {
    db.links.findOne({_from: req.body.link._from, _to: req.body.originalToId}, function (err, doc) {
      if (err) return res.error(err)
      if (!doc) return res.error(proxErr.notFound())

      linkId = doc._id

      /* The mongoose model save logic will parse the toCollectionId from the id */
      doc._to = link._to

      db.links.safeUpdate(doc, {user:req.user}, function(err, updatedDoc) {
        if (err) return res.error(err)
        if (!updatedDoc) return res.error(proxErr.serverError())
        updateActivityDate(req, res)
      })
    })
  }

  function updateActivityDate(req, res) {
    /*
     * We need to update the activity date for the old parent
     * and the new parent.
     */
    if (!req.body.skipActivityDate) {
      /* Fire and forget */
      methods.propogateActivityDate(req.body.originalToId, activityDate)
      methods.propogateActivityDate(req.body.link._to, activityDate)
    }
    done(req, res)
  }

  function done(req, res) {
    res.send({
      info: 'Link updated',
      count: 1,
      data: {_id: linkId}
    })
  }
}
