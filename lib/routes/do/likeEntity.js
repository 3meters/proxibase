/*
 * trackEntity
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

  var link = { _from:req.user._id, _to:req.body.entityId, type:'like' }
  var options = { user:req.user, adminOwns:true }

  db.links.safeInsert(link, options, function(err, savedDoc) {
    if (err) return res.error(err)
    req.insertedLink = savedDoc

    log('Logging like action for entity: ' + req.body.entityId)
    var actionType = 'like'

    if (req.body.entityType === methods.statics.typePlace) actionType += '_place'
    if (req.body.entityType === methods.statics.typePicture) actionType += '_candigram'
    if (req.body.entityType === methods.statics.typePost) actionType += '_candigram'

    methods.logAction({
      _target:        req.body.entityId,
      targetSource:   'aircandi',
      type:           actionType,
      _user:          req.user._id,
      data:           req.body.observation
    }) // don't wait for callback

    finish(req, res)
  })

  function finish(req, res) {
    res.send(201, {
      data: [req.insertedLink],
      date: util.now(),
      count: 1,
    })
  }
}
