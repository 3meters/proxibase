/*
 * removeLinks
 */

var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    fromId:           {type: 'string', required: true },
    toId:             {type: 'string', required: true },
    type:             {type: 'string', required: true },
    actionEvent:      {type: 'string' },
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var dbOps = {user: req.user}
  var messageIds = []
  var activityDate = util.now()

  db.messages.find({ $or: [ { _root: req.body.fromId }, { _id: req.body.fromId }] }).toArray(function(err, docs) {
    if (err) return done(err)
    if (!docs || docs.length === 0) return done()

    docs.forEach(function(doc) {
      messageIds.push(doc._id)
    })

    log('found messages', messageIds)

    db.links.find({ _from:{ $in: messageIds }, _to: req.body.toId, type: req.body.type }).toArray(function(err, links) {
      if (err) return res.error(err)
      if (links.length === 0) return done()

      async.forEach(links, processLink, finish)

      function processLink(link, next) {

        db.links.safeRemove({ _id: link._id }, dbOps, function(err) {
          if (err) return next(err)
          log('Deleted ' + req.body.type + ' link from ' + link._id + ' to ' + req.body.toId)
          next()
        })
      }

      function finish(err) {
        if (err) return res.error(err)

        log('updating activityDate properties for: ' + req.body.toId)

        /* This is done with super permissions and should not effect the modifedDate. */
        db.messages.update({ _id: req.body.toId }, { $set: { activityDate: activityDate }}, { safe: true, multi: false }, function(err) {
          if (err) return res.error(err)

          if (req.body.actionEvent) {
            log('Logging ' + req.body.actionEvent + ' action event for ' + req.body.toId)
            methods.logAction({
              event: req.body.actionEvent,
              _user: req.user._id,
              _entity: req.body.fromId,
            }) // don't wait for callback
          }

          done()
        })
      }
    })
  })

  function done() {
    res.send(200, {
      info: 'Links deleted successfully',
      date: util.now(),
      count: messageIds.length,
    })
  }
}
