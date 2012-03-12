/*
 * Create dummy datafiles to load into prox
 */

var
  cBeacons = 3,
  cEntities = 15,
  fs = require('fs'),
  jid = '0000.000000.00000.000.000001',
  gid = '0000.000000.00000.000.000002',
  log = require('../../lib/util').log

function run() {
  genUsers()
  genBeacons(cBeacons)
  // genEntities(cEntities)
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
  serialize(users, 'users')
}

function genBeacons(count) {
  var beacons = [], beaconsPrefix = '0003'
  for (var i = 0; i < count; i++) {
    // make a macID
    var id = pad(i,12)
    id = delineate(id, 2, ':')
    id = beaconsPrefix + ':' + id
    beacons.push({
      _id: id,
      ssid: 'Test Beacon ' + i,
      beaconType: 'fixed',
      latitude: 47.659052376993834,     // jays house for now
      longitude: -122.659052376993834,
      visibility: 'public'
    })
  }
  serialize(beacons, 'beacons')
}

function genEntity(iEntity, iTbl, cb) {
  if (!iEntity--) return cb(iTbl)
  var parentId = iEntity - (iEntity % 5)
  entities[iEntity] = {
    _id: genId(entityModelId, iEntity),
    _owner: jid,
    _creator: jid,
    _modifier: jid,
    name: 'Test Entity ' + iEntity,
    type: 'post'
  }
  if (parentId != iEntity) entities[iEntity]._entity = genId(entityModelId, parentId)

  // every third entity gets a comment
  if (!(iEntity % 3)) {
    comments.push({
      _id: genId(commentModelId, comments.length),
      _owner: jid,
      _modifier: jid,
      _creator: jid,
      _entity: genId(entityModelId, iEntity),
      title: "Comment on entity " + iEntity
    })
  }
  genEntity(iEntity, iTbl, cb)
}

function serialize(tbl, name) {
  tbl.forEach(function(row) {
    row._owner = jid
    row._creator = jid
    row._modifier =  jid
  })
  fs.writeFileSync('./files/' + name + '.json', JSON.stringify(tbl))
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
