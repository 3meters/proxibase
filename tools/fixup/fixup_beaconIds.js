/*
 * fixup_beaconsIds
 * - load beacons, change separator between the tableId and key to '.' and replace
 * - load links and observations and fix their beaconIds
 */

var
  config = exports.config = require('../../conf/config'),  
  mdb = require('../../lib/main').mdb,  // mongodb connection object  
  mongoskin = require('mongoskin'),  
  log = require('../../lib/util').log,
  sendErr = require('../../lib/util').sendErr

// Our own connection so we don't need to have proxibase service running
var db = mongoskin.db(config.mdb.host + ':' + config.mdb.port +  '/' + config.mdb.database + '?auto_reconnect')

updateBeacons()

function updateBeacons() {
  db.collection('beacons').find().toArray(function(err, beacons) {
    log('find returned ' + beacons.length + ' beacons')
    for (var i = beacons.length; i--;) {
      var beacon = beacons[i]

      db.collection('beacons').remove({_id:beacon._id}, {safe:true}, function(err) {
        if (err) return res.sendErr(err)

        beacon._id = beacon._id.substring(0, 4) + '.' + beacon._id.substring(5)

        var doc = new mdb.models['beacons'](beacon)
        doc.save(function (err, savedDoc) {
          if (err) return res.sendErr(err)
          if (!savedDoc._id) {
            var err =  new Error('Insert failed for unknown reason. Call for help')
            logErr('Server error: ' +  err.message)
            logErr('Document:', doc)
            return res.sendErr(err, 500)
          }
          //updateLinks()
        })
      })
    }
  })
}

function updateLinks() {
  db.collection('links').find().toArray(function(err, links) {
    log('find returned ' + links.length + ' links')
    for (var i = links.length; i--;) {
      links[i]._beacon.replace(':','.')
      db.collection('links').update({_id:links[i]._id}, links[i], {safe:true}, function(err) {
        if (err) return sendErr(res, err)
      })
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
