/**
 * routes/echo.js
 *
 *   Hello world method returns its input
 */


exports.addRoutes = function(app) {
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
