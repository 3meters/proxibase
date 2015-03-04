/*
 * deleteVerbLink
 */

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

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var link = req.body
  var dbOps = _.cloneDeep(req.dbOps)

  if (tipe.isDefined(link.activityDateWindow)) {
    dbOps.activityDateWindow = link.activityDateWindow
  }

  db.links.safeFindOne({_from: link.fromId, _to: link.toId, type: link.type}, dbOps, function(err, link) {
    if (err) return res.error(err)
    if (!link) return res.error(perr.notFound())
    db.links.safeRemove({_id: link._id}, dbOps, function(err, meta) {
      if (err) return res.error(err)
      meta.deprecated = true
      meta.info = 'Use DELETE /data/links/<_link>'
      res.send(meta)
    })
  })
}
