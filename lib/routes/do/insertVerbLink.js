/*
 * insertVerbLink
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  var _body = {
    toId: {type: 'string', required: true},
    fromId: {type: 'string', required: true},
    verb: {type: 'string', required: true},
    actionType: {type: 'string', required: true},
    observation: {type: 'object'},
  }

  var body = req.body
  var err = util.check(body, _body)
  if (err) return res.error(err)

  var link = { _from:req.body.fromId, _to:req.body.toId, type:req.body.verb }
  log('Inserting ' + req.body.verb + ' link from ' + req.body.fromId + ' to ' + req.body.toId)
  db.links.safeInsert(link, { user:req.user, adminOwns:true }, function(err, savedDoc) {
    if (err) return res.error(err)
    req.insertedLink = savedDoc

    log('Logging ' + req.body.actionType + ' action for ' + req.body.toId)

    methods.logAction({
      _target:        req.body.toId,
      targetSource:   'aircandi',
      type:           req.body.actionType,
      _user:          req.user._id,
      data:           req.body.observation
    }) // don't wait for callback

    res.send(201, {
      data: [req.insertedLink],
      date: util.now(),
      count: 1,
    })
  })
}
