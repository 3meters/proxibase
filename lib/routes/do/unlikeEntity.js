/*
 * unlikeEntity
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  var _body = {
    entityId: {type: 'string', required: true},
    entityType: {type: 'string', required: true},
    observation: {type: 'object'},
  }

  var body = req.body
  var err = util.check(body, _body)
  if (err) return res.error(err)

  db.links.findOne({ _from:req.user._id, _to:req.body.entityId, type:'like' }, function(err, link) {
    if (err) return res.error(err)
      
    if (!link) {
      done(req, res)
    }
    else {
      log('Deleting like link: ' + link._id)

      db.links.safeRemove({ _id: link._id }, { user:req.user, asAdmin:true }, function(err) {
        if (err) return res.error(err)

        log('Logging unlike action for entity: ' + req.body.entityId)
        var actionType = 'unlike_content'
        if (req.body.entityType === util.statics.typePlace) actionType = 'unlike_place'

        methods.logAction({
          _target:        req.body.entityId,
          targetSource:   'aircandi',
          type:           actionType,
          _user:          req.user._id,
          data:           req.body.observation
        }) // don't wait for callback
        done(req, res)
      })
    }
  })

  function done(req, res) {
    res.send(200, {
      info: 'Unlike successful for entity ' + req.body.entityId,
      date: util.now(),
      count: 1,
    })
  }
}
