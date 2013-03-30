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
    info: 'param checker: method: POST, body:{param:param, template:template}'
  })
}

function post(req, res) {
  var body = req.body
  var _body = {
    param: {required: true},
    template: {required: true}
  }
  var err = util.check(body, _body)
  if (err) return res.error(err)
  err = util.check(body.param, body.template)
  if (err) return res.error(err)
  res.send(body.param)
}
