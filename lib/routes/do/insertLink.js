/*
 * insertLink
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
    strong:       {type: 'boolean' },
    actionType:   {type: 'string' },
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var link = { _from:req.body.fromId, _to:req.body.toId, type:req.body.type }
  if (req.body.strong) link.strong = req.body.strong
    
  db.links.safeInsert(
    { _from:req.body.fromId, _to:req.body.toId, type:req.body.type }, { user:req.user }, 
    function(err, savedDoc) {
    if (err) return res.error(err)

    log('Inserted ' + req.body.type + ' link from ' + req.body.fromId + ' to ' + req.body.toId)
    req.insertedLink = savedDoc

    if (req.body.actionType) {
      log('Logging ' + req.body.actionType + ' action for ' + req.body.toId)
      methods.logAction({
        _target:        req.body.toId,
        type:           req.body.actionType,
        _user:          req.user._id,
      }) // don't wait for callback
    }

    res.send(201, {
      data: [req.insertedLink],
      date: util.now(),
      count: 1,
    })
  })
}
