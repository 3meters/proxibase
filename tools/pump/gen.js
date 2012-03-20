/*
 * Create dummy datafiles to load into a proxibase server
 *
 * Usage:
 *
 *    node gen
 *
 *    node gen --help
 */

var
  fs = require('fs'),
  path = require('path'),
  program = require('commander'),
  jid = '0000.000000.00000.555.000001',
  gid = '0000.000000.00000.555.000002',
  log = require('../../lib/util').log

program
  .option('-b, --beacons <beacons>', 'beacons to generate [3]', Number, 3)
  .option('-e, --epb <epb>', 'entities per beacon [5]', Number, 5)
  .option('-c, --cpe <cpe>', 'child entities per entity [5]', Number, 5)
  .option('-o, --out <files>', 'output direcotry [files]', String, 'files')
  .parse(process.argv)

function run() {
  genUsers()
  genBeacons(program.beacons)
  genEntities(program.beacons * program.epb)
}

function genUsers() {
  var users = []
  users.push({
    _id: jid,
    name: 'Jay Gecko',
    email: 'jay@3meters.com',
    location: 'Seattle, WA',
    facebookId: 'george.snelling',
    pictureUri: 'https://s3.amazonaws.com/3meters_images/1001_20120211_103113.jpg',
    isDeveloper: true
  })
  users.push({
    _id: gid,
    name: 'George Snelling',
    email: 'george@3meters.com',
    location: 'Seattle, WA',
    facebookId: '696942623',
    pictureUri: 'https://graph.facebook.com/george.snelling/picture?type=large',
    isDeveloper: true
  })
  save(users, 'users')
}

function makeBeaconId(recNum) {
  var id = pad(recNum, 12)
  id = delineate(id, 2, ':')
  return '0003:' + id
}

function genBeacons(count) {
  var beacons = [], beaconsPrefix = '0003'
  for (var i = 0; i < count; i++) {
    beacons.push({
      _id: makeBeaconId(i),
      ssid: 'Test Beacon ' + i,
      beaconType: 'fixed',
      latitude: 47.659052376993834,     // jays house for now
      longitude: -122.659052376993834,
      visibility: 'public'
    })
  }
  save(beacons, 'beacons')
}

function genEntities(count) {
  var
    entities = [], entPrefix = '0002',
    links = [], linkPrefix = '0001',
    parentId = '',
    root = false

  for (var i = 0; i < count; i++) {
    var id = entPrefix + '.010101.00000.555.' + pad(i, 6)
    root = false

    // is entity a root
    if (i % program.cpe === 0) { // children per entity
      root = true
      parentId = id
      // link to beacon
      var beaconNum = Math.floor(i / program.epb) // entities per beacon
      links.push({
        _from: id,
        _to: makeBeaconId(beaconNum)
      })
    }
    entities.push({
      _id: id,
      imagePreviewUri: "https://s3.amazonaws.com/3meters_images/1000_test_parent_ent_preview.jpg",
      imageUri: "https://s3.amazonaws.com/3meters_images/1000_test_parent_ent.jpg",
      label: "Test Entitiy " + i,
      signalFence: -100,
      title: "Test Entity " + i,
      type: "com.proxibase.aircandi.candi.picture",
      comments: [ ],
      visibility: "public",
      enabled: true,
      locked: false,
      linkJavascriptEnabled: false,
      linkZoom: false,
      root: root
    })
    if (!root) {
      links.push({
        _from: id,
        _to: parentId
      })
    }
  }
  save(entities, 'entities')
  save(links, 'links')
}

function save(tbl, name) {
  if (!path.existsSync(program.out)) fs.mkdirSync(program.out)
  tbl.forEach(function(row) {
    row._owner = jid
    row._creator = jid
    row._modifier =  jid
  })
  fs.writeFileSync(program.out + '/' + name + '.json', JSON.stringify(tbl))
}

function pad(number, digits) {
  var s = number.toString()
  assert(s.indexOf('-') < 0 && s.indexOf('.') < 0 && s.length <= digits, "Invalid id seed: " + s)
  for (var i = digits - s.length, zeros = ''; i--;) {
    zeros += '0'
  }
  return zeros + s
}

// put sep in string s at every freq. return delienated s
function delineate(s, freq, sep) {
  var cSeps = Math.floor(s.length / freq)
  for (var out = '', i = 0; i < cSeps; i++) {
    out += s.slice(0, freq) + sep
    s = s.slice(freq)
  }
  return out.slice(0,-1) + s // trim the last sep and add the remainder
  
}

function genId(tableId, recNum) {
  recNumStr = pad(recNum, 6)
  return '000' + tableId.toString() + '.010101.00000.000.' + recNumStr
}

run()
