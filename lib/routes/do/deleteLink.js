/*
 * deleteVerbLink
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    fromId:       {type: 'string', required: true },
    toId:         {type: 'string', required: true },
    type:         {type: 'string', required: true },
    actionType:   {type: 'string' },
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  db.links.findOne({ _from:req.body.fromId, _to:req.body.toId, type:req.body.type }, function(err, link) {
    if (err) return res.error(err)
      
    if (!link) {
      done(req, res)
    }
    else {
      req.linkId = link._id
      db.links.safeRemove({ _id: link._id }, { user:req.user, asAdmin:true }, function(err) {
        if (err) return res.error(err)

        log('Deleted ' + req.body.verb + ' link from ' + req.body.fromId + ' to ' + req.body.toId)
      
        if (req.body.actionType) {
          log('Logging ' + req.body.actionType + ' action for ' + req.body.toId)
          methods.logAction({
            _target:        req.body.toId,
            type:           req.body.actionType,
            _user:          req.user._id,
          }) // don't wait for callback
        }
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
