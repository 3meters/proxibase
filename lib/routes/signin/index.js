/**
 * lib/routes/signin/index.js
 *
 * Simple WebUI to sign in and out
 */

var qs = require('qs')

// Data router
exports.addRoutes = function(app) {
  app.get('/signin', showSigninForm)
  app.post('/signin', signin)
}


function showSigninForm(req, res) {
  res.isHtml = true
  res.sendFile(__dirname + '/signin.html')
}

function signin(req, res) {
  util.request.post(util.config.service.uri + '/v1/auth/signin')
    .send({
      email: req.body.email,
      password: req.body.password,
      installId: 'www',
    })
    .end(function(err, sres, body) {
      if (err) {
        res.isHtml = true
        return res.send('<html><h2>' + (err.message || 'Error') + '</h2></html>')
      }
      res.redirect('/v1/?' + qs.stringify({
        user: body.user._id,
        session: body.session.key,
      }))
    })
}
