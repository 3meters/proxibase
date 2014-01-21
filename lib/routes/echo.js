/**
 * routes/echo.js
 *
 *   Hello world method returns its input
 */


exports.addRoutes = function(app) {

  // for testing cluster restart
  app.get('/crash', function(req, res) {
    if (!(req.user && 'admin' === req.user.role)) return res.error(perr.badAuth())
    setTimeout(function() {throw new Error('Kaboom')}, 1000)
    res.send({info: 'death is coming'})
  })

  app.get('/echo/?', function(req, res) {
    res.send({
      uri: '/echo',
      method: 'POST',
      body: {key: 'val'}
    })
  })

  app.post('/echo/?', function(req, res) {
    res.send(req.body)
  })
}
