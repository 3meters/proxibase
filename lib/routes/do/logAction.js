/**
 * logAction
 */

var db = util.db
var methods = require('./methods')

module.exports.main = function(req, res) {

  var _body = {
    targetId:     {type: 'string', required: true},
    targetSource: {type: 'string', required: true}, // aircandi, foursquare
    actionType:   {type: 'string', required: true}, // tune_custom_first, tune_synthetic_first, browse
    userId:       {type: 'string', required: true},
  }

  var body = req.body
  var err = util.check(body, _body)
  if (err) {
    logErr(err)
    return res.error(err)
  }

  var action = {
    _target:      body.targetId,
    targetSource: body.targetSource,
    type:         body.actionType,
    _user:        body.userId,
  }

  methods.logAction(action, function(err, savedAction) {
    if (err) return res.error(err)
    res.send({
      info: 'Action logged',
      count: 1,
      data: {_target: req.body.targetId}
    })
  })
}
