/*
 * deleteVerbLink
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    fromId:             {type: 'string', required: true },
    toId:               {type: 'string', required: true },
    type:               {type: 'string', required: true },
    actionEvent:         {type: 'string' },
    activityDateWindow: {type: 'number' },      // for testing to override system default
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var dbOps = {user: req.user}
  if (tipe.isDefined(req.body.activityDateWindow)) {
    dbOps.activityDateWindow = req.body.activityDateWindow
  }

  db.links.findOne({ _from:req.body.fromId, _to:req.body.toId, type:req.body.type }, function(err, link) {
    if (err) return res.error(err)

    if (!link) {
      done(req, res)
    }
    else {
      req.linkId = link._id
      db.links.safeRemove({ _id: link._id }, dbOps, function(err) {
        if (err) return res.error(err)

        log('Deleted ' + req.body.type + ' link from ' + req.body.fromId + ' to ' + req.body.toId)

        var activityDate = util.now()
        var toIdParsed = util.parseId(req.body.toId)

        log('updating activityDate properties for: ' + req.body.toId)

        /* This is done with super permissions and should not effect the modifedDate. */
        db[toIdParsed.collectionName].update({ _id: req.body.toId }, { $set: { activityDate: activityDate }}, { safe: true, multi: false }, function(err) {
          if (err) return res.error(err)

          if (req.body.actionEvent) {
            log('Logging ' + req.body.actionEvent + ' action event for ' + req.body.toId)
            methods.logAction({
              event: req.body.actionEvent,
              _user: req.user._id,
              _entity: req.body.toId,
            }) // don't wait for callback
          }
          done()
        })
      })
    }
  })

  function done() {
    res.send(200, {
      info: 'Delete successful for link ' + req.linkId,
      date: util.now(),
      count: 1,
    })
  }
}
