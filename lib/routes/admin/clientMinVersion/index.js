/**
 * lib/routes/admin/clientMinVersion/index.js
 *
 * Simple WebUI to set the clientMiniumVersion
 *
 * This can be used to force clients to upgrade to a new version
 * before the app will work.  Very useful when shipping breaking
 * changes.
 *
 */

var qs = require('querystring')


function showForm(req, res) {
  res.isHtml = true
  res.sendFile(__dirname + '/form.html')
}


function set(req, res) {
  res.redirect('/v1/admin?' + qs.stringify(req.user.cred))
  /*
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
  */
}

exports.showForm = showForm
exports.set = set
