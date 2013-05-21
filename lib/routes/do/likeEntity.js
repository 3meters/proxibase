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

  db.links.safeInsert(link, { user:req.user, adminOwns:true }, function(err, savedDoc) {
    if (err) return res.error(err)
    req.insertedLink = savedDoc

    log('Logging like action for entity: ' + req.body.entityId)

    var actionType = 'like_content'
    if (req.body.entityType === util.statics.typePlace) actionType = 'like_place'

    methods.logAction({
      _target:        req.body.entityId,
      targetSource:   'aircandi',
      type:           actionType,
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
