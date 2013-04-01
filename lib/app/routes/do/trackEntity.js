/*
 * trackEntity
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  var _body = {
    entityId: {type: 'string', required: true},
    actionType: {type: 'string', required: true},
    beacons: {type: 'array'},
    primaryBeaconId: {type: 'string'},
    observation: {type: 'object'},
    respondOnAccept: {type: 'boolean'},
  }

  var body = req.body
  var err = util.check(body, _body)
  if (err) return res.error(err)

  if (body.respondOnAccept) {
    res.send({
      info: 'Track Entity request received',
      date: util.now(),
      count: 1,
      data: {}
    })
  }

  if (!req.body.beacons) {
    if (req.body.observation) {
      /*
       * We only have observation data so log the action and finish.
       */
      db.entities.findOne({ _id:req.body.entityId }, function(err, doc) {
        if (err) {
          util.logErr('Finding entity failed in trackEntity for req ' + req.tag, err)
        }
        if (doc) {
          methods.logAction({
            _target: doc._id,
            targetSource: 'aircandi',
            type: 'entity_' + req.body.actionType,
            _user: req.user._id,
            data: req.body.observation
          }) // don't wait for callback
        }
        return finish()
      })
    }
    else return finish()
  }

  async.forEach(req.body.beacons, processBeacon, trackEntity)

  function processBeacon(beacon, next) {
    db.beacons.findOne({_id:beacon._id}, function(err, doc) {
      if (err) return next(err)
      if (doc) {
        log('Beacon found: ' + beacon._id)
        return next()
      }

      log('Inserting beacon: ' + beacon._id)
      var options = {user:req.user, adminOwns:true}
      db.beacons.safeInsert(beacon, options, function(err, savedDoc) {
        if (err) return next(err)
        next()
      })
    })
  }

  function trackEntity(err) {
    if (err) {
      logErr('Non-fatal error in tackEntity for req ' + req.tag, err)
    }

    async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary

    function processBeacon(beacon, next) {
      var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId === beacon._id)
      log('Linking entity ' + req.body.entityId + ' to beacon ' + beacon._id + ' using type ' + req.body.actionType)
      db.links.findOne({ _from:req.body.entityId, _to:beacon._id, type:req.body.actionType }, function(err, doc) {

        if (err) return next(err)
        if (doc) {
          if (primary) {
            log('Logging action for place entity primary link: ' + doc._id)
            methods.logAction({
              _target:      doc._id,
              targetSource: 'aircandi',
              type:         'link_' + req.body.actionType,
              _user:        req.user._id,
              data:         req.body.observation,
            }) // don't wait for callback
            if (!doc.primary) {
              doc.primary = true
              var options = {asAdmin:true, user:util.adminUser}
              db.links.safeUpdate(doc, options, function(err, updatedLink) {
                if (err) return next(err)
                if (!updatedLink) return next(err)
                return next()
              })
            }
            else {
              return next()
            }
          }
          else {
            return next()
          }
        }
        else {
          var link = {_from:req.body.entityId, _to:beacon._id, primary:primary, signal:beacon.level, type:req.body.actionType}
          var options = {user:req.user, adminOwns:true}
          db.links.safeInsert(link, options, function(err, savedDoc) {
            if (err) return next(err)
            if (primary) {
              log('Logging action for place entity primary link: ' + savedDoc._id)
              methods.logAction({
                _target:      savedDoc._id,
                targetSource: 'aircandi',
                type:         'link_' + req.body.actionType,
                _user: req.user._id,
                data: req.body.observation
              }) // don't wait for callback
            }
            return next()
          })
        }
      })
    }
  }

  function finish(err) {
    var out = {
      info: 'Entity tracked',
      date: util.now(),
      count: 1,
      data: {}
    }
    if (err) {
      util.logErr('trackEntity inlcuded non-fatal error for req ' + req.tag, err)
      out.info += ' with warning: ' + err.message
    }
    if (!body.respondOnAccept) {
      res.send(out)
    }
  }
}
