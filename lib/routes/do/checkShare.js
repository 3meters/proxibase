/**
 * checkShare
 *
 * Check if an entity has been shared with a user.
 */
var async = require('async')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:       { type: 'string', required: true },
    userId:         { type: 'string', required: true },
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var shareLink = []

  /*
   * A share check is a two step process. First, we check for for all
   * share links to the target entity. That lets us identify the relevant share
   * messages. Next we check to see if any of those share messages have a share
   * link to the user. If we find a match, we finish and send the link back
   * in the response.
   *
   * We don't create a share link directly between the user and the entity because
   * using the share message as the intersection allows the original sharing user to
   * revoke their share by deleting the share message.
   *
   * George: This seems like it could be tightened up and made less confusing.
   */
  var query = {
    _to: req.body.entityId,
    type: 'share',
  }

  var dbOps =  util.clone(req.dbOps)

  db.links.safeFind(query, dbOps, function(err, shareMsgLinks) {
    if (err) return finish(err)
    if (!shareMsgLinks.length) return finish()

    async.eachSeries(shareMsgLinks, findLinkFromShareMsgToUser, finish)

    function findLinkFromShareMsgToUser(shareMsgLink, nextLink) {

      var userShareLinkQry = {
        _to: req.body.userId,
        _from: shareMsgLink._from,
        type: 'share',
      }

      db.links.safeFindOne(userShareLinkQry, dbOps, function(err, invite) {
        if (err) return nextLink(err)
        if (invite) {
          shareLink.push(invite)
          return finish()
        }
        nextLink()
      })
    }
  })

  function finish(err) {
    if (err) return res.error(err)
    log('shareLink', shareLink)
    res.send({
      info: shareLink.length === 0 ? 'Entity not shared' : 'Entity shared',
      date: util.now(),
      count: shareLink.length,
      data: shareLink,
    })
  }
}