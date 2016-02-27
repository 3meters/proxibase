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


// Disabled.  Set via /admin/state or in the config file
function set(req, res) {
  res.redirect('/v1/admin?' + qs.stringify(req.user.cred))
}

exports.showForm = showForm
exports.set = set
