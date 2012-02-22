/*
 * Load dummy data into prox and school
 */

var
  req = require('request'),
  _ = require('underscore'),
  log = require('../lib/log'),
  parse = require('./util').parseRes,
  _baseUri = require('./util')._baseUri,
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
    { fn: loadEntities, count: 100 },
    { fn: loadDrops, count: 100 }
  ]

  // go
  tables.forEach(function(load, i) {
    log('table ' + i)
    load.fn(load.count)
  })

  log('beacons', beacons)

  function loadBeacons(i) {
    if (!i--) return
    var s = i.toString()
    if (i < 10) s = '0' + s
    beacons[i] = {
      _id: '0001.120201.00000.0000' + s,
      name: '99:99:00:00:00:' + s,
      ssid: 'Test Beacon ' + s
    }
    loadBeacons(i)
  }

  function loadEntities(i) {
    if (!i--) return
    loadEntities(i)
  }

  function loadDrops(i) {
    if (!i--) return
    loadDrops(i)
  }
}

exports.prox()
