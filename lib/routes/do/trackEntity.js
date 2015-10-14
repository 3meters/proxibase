/*
 * track / untrack Entity
 *
 *  Entity is always a patch.  Make sure the patch exists and that the
 *  calling user owns it or is an admin.  If track, upsert the beacons
 *  and link them to the patch.  If untrack, remove all links between
 *  the supplied beacons and the patch.
 *
 */

var async = require('async')

exports.main = function(req, res) {
  exports.run('track', req, res)
}

exports.run = function(cmd, req, res) {

  var spec = {
    entityId:  { type: 'string', required: true },
    beacons:   { type: 'array', value: { type: 'object' }},
  }

  var err = scrub(req.body, spec)
  if (err) return finish(err)

  if (!req.user) return finish(perr.badAuth())

  // Noop if there are no beacons
  if (!(req.body.beacons && req.body.beacons.length)) {
    return finish(result)
  }

  // If necessary generate the beacon._id from the bssid
  var beacons = []
  req.body.beacons.forEach(function(beacon) {
    if (!beacon._id) beacon._id = db.beacons.genId(beacon)
    if (beacon._id) beacons.push(beacon)
  })

  // Set up the default result
  var result = {info: 'Tracked', count: 1}
  if (cmd === 'untrack') result.info = 'Untracked'

  db.patches.safeFindOne({_id: req.body.entityId}, req.dbOps, function(err, patch) {
    if (err) return finish(err)

    if (!patch) {
      result.count = 0
      return finish()
    }

    // For now only the patch owner can track the entity
    if (patch._owner !== req.user._id &&
      req.user.role !== 'admin') return finish(perr.badAuth())

    if (cmd === 'track') return track(patch)
    else return untrack(patch)
  })


  function track(patch) {

    var beaconOps = _.cloneDeep(req.dbOps)
    beaconOps.user = util.statics.adminUser

    async.eachSeries(beacons, linkBeacon, finish)

    function linkBeacon(beacon, nextBeacon) {
      db.beacons.safeUpsert(beacon, beaconOps, function(err, savedBeacon) {
        if (err) return finish(err)
        if (!savedBeacon) return finish(perr.serverError('Failed to upsert beacon:', beacon))

        var link = {
          _from: patch._id,
          _to: savedBeacon._id,
          type: 'proximity',
        }

        db.links.safeFind(link, req.dbOps, function(err, foundLinks) {
          if (err) return finish(err)
          if (foundLinks && foundLinks.length) return nextBeacon()  // TODO: we could update the link with current location
          db.links.safeInsert(link, req.dbOps, nextBeacon)
        })
      })
    }
  }


  // Unlink all the beacons from the patch.  Leave the beacons in the db
  function untrack(patch) {
    var beaconIds = beacons.map(function(beacon) { return beacon._id })

    var linkOps = _.extend(_.clone(req.dbOps), {
      asAdmin: true,
      limit: util.statics.db.limits.max,
    })

    var query = {
      _from: patch._id,
      _to: {$in: beaconIds},
      type: 'proximity',
    }

    db.links.safeFind(query, linkOps, function(err, links) {
      if (err) return finish(err)
      if (!(links && links.length)) return finish(result)

      async.eachSeries(links, deleteLink, finish)

      function deleteLink(link, next) {
        db.links.safeRemove({_id: link._id}, linkOps, next)
      }
    })
  }

  function finish(err) {
    if (err) return res.send(err)
    res.send(result)
  }
}
