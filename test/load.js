/*
 * Load dummy data into prox and school
 */

var
  req = require('request'),
  _ = require('underscore'),
  log = require('../lib/log'),
  parse = require('./util').parseRes,
  _baseUri = require('./util').getBaseUri(),
  beacons = [],
  entities = [],
  drops = [],
  _options = {
    headers: {
      "content-type": "application/json"
    }
  }

exports.prox = function() {
  var tables = [
    { fn: loadBeacons, count: 10 },
    { fn: loadEntities, count: 10 },
    { fn: loadDrops, count: 10 }
  ]

  loadTable(tables.length)

  function loadTable(iTable, cb) {
    if (!iTable--) {
      log('\nFinished ok')
      process.exit(0)
    }
    log('\nLoading table ' + iTable)
    tables[iTable].fn(tables[iTable].count, iTable, loadTable)
  }

  function loadBeacons(iBeacon, iTbl, cb) {
    if (!iBeacon--) return cb(iTbl)
    log('Loading Beacon ' + iBeacon)
    var s = iBeacon.toString()
    if (iBeacon < 10) s = '0' + s
    beacons[iBeacon] = {
      _id: '0001.120201.00000.0000' + s,
      name: '99:99:00:00:00:' + s,
      ssid: 'Test Beacon ' + s
    }
    loadBeacons(iBeacon, iTbl, cb)
  }

  function loadEntities(iEntity, iTbl, cb) {
    if (!iEntity--) return cb(iTbl)
    log('Loading Entity ' + iEntity)
    loadEntities(iEntity, iTbl, cb)
  }

  function loadDrops(iDrop, iTbl, cb) {
    if (!iDrop--) return cb(iTbl)
    log("Loading Drop " + iDrop)
    loadDrops(iDrop, iTbl, cb)
  }
}

exports.prox()
