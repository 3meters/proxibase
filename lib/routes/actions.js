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
  var search = {
    query: {_user: req.params.userId},
    countBy: ['_user', 'event']
  }
  var dbOps = {
    user: req.user || util.anonymousUser,
    asAdmin: true,
  }
  db.actions.safeFind(search, dbOps, function(err, results) {
    res.send(err, results)
  })
}
