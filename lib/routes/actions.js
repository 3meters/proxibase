/**
 * routes/actions
 *   provide sumarized aggregations over the actions system collection
 */


exports.addRoutes = function(app) {
  app.get('/actions/user_events/:userId', countByUserByEvent)
}

/*
 * User actions by event
 */
function countByUserByEvent(req, res) {
  var query = {_user: req.params.userId}
  var options = {
    countBy: ['event'],
    user: req.user || util.anonymousUser,
    asAdmin: true,
  }
  db.actions.safeFind(query, options, function(err, docs, meta) {
    var body = {data: docs}
    body = _.extend(body, meta)
    res.send(err, body)
  })
}
