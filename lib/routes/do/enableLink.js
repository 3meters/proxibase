/*
 * enableLink
 */

var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    fromId:             {type: 'string', required: true },
    toId:               {type: 'string', required: true },
    type:               {type: 'string', required: true },
    enabled:            {type: 'boolean', required: true },
    actionEvent:        {type: 'string' },
    activityDateWindow: {type: 'number' },      // for testing to override system default
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var dbOps = { user: req.user }
  if (tipe.isDefined(req.body.activityDateWindow)) {
    dbOps.activityDateWindow = req.body.activityDateWindow
  }

  db.links.findOne({ _from:req.body.fromId, _to:req.body.toId, type:req.body.type }, function(err, link) {
    if (err) return res.error(err)

    if (!link) {
      done(req, res)
    }
    else {

      link.enabled = req.body.enabled

      /* This is done using admin because the link approver doesn't own the link */
      db.links.safeUpdate(link, {user: util.adminUser}, function(err, updatedDoc) {
        if (err) return res.error(err)
        if (!updatedDoc) return res.error(perr.notFound())

        var activityDate = util.now()
        var toIdParsed = util.parseId(link._to)

        log('updating activityDate properties for: ' + link._to)

        /* This is done with super permissions and should not effect the modifedDate. */
        db[toIdParsed.collectionName].update({ _id: link._to }, { $set: { activityDate: activityDate }}, { safe: true, multi: false }, function(err) {
          if (err) return res.error(err)

          if (req.body.actionEvent) {
            log('Logging ' + req.body.actionEvent + ' action event for ' + link._to)
            methods.logAction({
              event: req.body.actionEvent,
              _user: req.user._id,
              _entity: link._to,
            }) // don't wait for callback
          }
          done()
        })
      })
    }
  })

  function done() {
    res.send(200, {
      info: 'Link enabled update successful',
      date: util.now(),
      count: 1,
    })
  }
}
