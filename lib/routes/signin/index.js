/**
 * lib/routes/signin/index.js
 *
 * Simple WebUI to sign in and out
 */

var qs = require('querystring')

// Data router
exports.addRoutes = function(app) {
  app.get('/signin', showSigninForm)
  app.post('/signin', signin)
}


// ShowSigninForm does what it says
function showSigninForm(req, res) {
  res.isHtml = true
  res.sendFile(__dirname + '/signin.html')
}


function signin(req, res) {
  util.request.post(util.config.service.uri +
    '/' + util.config.service.defaultVersion + '/auth/signin')
    .send({
      email: req.body.email,
      password: req.body.password,
    })
    .end(function(err, sres, body) {
      if (err) {
        res.isHtml = true
        return res.send('<html><h2>' + (err.message || 'Error') + '</h2></html>')
      }
      res.redirect('/' + util.config.service.defaultVersion + '/?' + qs.stringify({
        user: body.user._id,
        session: body.session.key,
      }))
    })
}
