/**
 * routes/check
 *   public testing endpoint for the parameter checker
 */

exports.addRoutes = function(app) {
  app.get('/check', get)
  app.post('/check', post)
}

function get(req, res) {
  return res.send({
    info: 'param checker: method: POST, body:{value:value, schema:schema, options:options}'
  })
}

function post(req, res) {
  var body = req.body
  var options = body.options || {}
  options.untrusted = true
  err = util.check(body.value, body.schema, options)
  if (err) return res.error(err)
  res.send({value: body.value}) // check may alter value
}
