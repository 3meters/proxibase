/*
 * deleteVerbLink
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

  db.links.findOne({ _from:req.body.fromId, _to:req.body.toId, type:req.body.verb }, function(err, link) {
    if (err) return res.error(err)
      
    if (!link) {
      done(req, res)
    }
    else {
      req.linkId = link._id
      log('Deleting ' + req.body.verb + ' link from ' + req.body.fromId + ' to ' + req.body.toId)

      db.links.safeRemove({ _id: link._id }, { user:req.user, asAdmin:true }, function(err) {
        if (err) return res.error(err)

        log('Logging ' + req.body.actionType + ' action for ' + req.body.toId)

        methods.logAction({
          _target:        req.body.toId,
          targetSource:   'aircandi',
          type:           req.body.actionType,
          _user:          req.user._id,
          data:           req.body.observation
        }) // don't wait for callback
        done(req, res)
      })
    }
  })

  function done(req, res) {
    res.send(200, {
      info: 'Delete successful for link ' + req.linkId,
      date: util.now(),
      count: 1,
    })
  }
}