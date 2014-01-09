/**
 * routes/actions
 *   provide sumarized aggregations over the actions system collection
 */


exports.addRoutes = function(app) {
  app.get('/actions/user_events/:userId', actionCountByUserByEvent)
}

/*
 * User actions by event
 */
function actionCountByUserByEvent(req, res) {
  var query = {_user: req.params.userId}
  var options = {
    countBy: ['_user', 'event'],
    user: req.user || util.anonymousUser,
    asAdmin: true,
  }
  db.actions.safeFind(query, options, function(err, results) {
    res.send(err, results)
  })
}
