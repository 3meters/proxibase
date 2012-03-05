/*
 * Create dummy datafiles to load into prox
 */

var
  cBeacons = 1,  // change to add more data, max 99
  fs = require('fs'),
  log = require('../../lib/util').log,
  beacons = [],
  entities = [],
  drops = [],
  comments = [],
  beaconModelId = 1,
  entityModelId = 2,
  dropModelId = 3,
  commentModelId = 4,
  jid = '0000.000000.00000.000.000001',
  gid = '0000.000000.00000.000.000002',
  tables = [
    { fn: genBeacon, count: cBeacons },
    { fn: genEntity, count: cBeacons * 15 }
  ]

loadTable(tables.length)

function loadTable(iTable, cb) {
  if (!iTable--) done()
  tables[iTable].fn(tables[iTable].count, iTable, loadTable)
}

function genBeacon(iBeacon, iTbl, cb) {
  if (!iBeacon--) return cb(iTbl)
  var s = iBeacon.toString()
  if (iBeacon < 10) s = '0' + s
  beaconId = genId(beaconModelId, iBeacon)
  beacons[iBeacon] = {
    _id: beaconId,
    _owner: jid,
    _creator: jid,
    _modifier: jid,
    bssid: '99:99:00:00:00:' + s,
    ssid: 'Test Beacon ' + iBeacon.toString()
  }
  for (var i = 3; i--;) {
    var entNum = ((iBeacon * 5) + (i * 5))
    var entityId = genId(entityModelId, entNum)
    var dropId = genId(dropModelId, entNum)
    genDrop(dropId, entityId, beaconId)
  }
  genBeacon(iBeacon, iTbl, cb)
}

function genDrop(dropId, entityId, beaconId) {
  drops.push({
    _id: dropId,
    _owner: jid,
    _creator: jid,
    _modifier: jid,
    _entity: entityId,
    _beacon: beaconId
  })
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
    out += s.slice(0, freq)
    s = s.slice(freq)
  }
  out += s
  log('s: ' + s + ' out: ' +  out)
}

function genId(tableId, recNum) {
  recNumStr = pad(recNum, 6)
  return '000' + tableId.toString() + '.100101.55555.000.' + recNumStr
}

function done() {
  fs.writeFileSync('entities.json', JSON.stringify(entities))
  fs.writeFileSync('beacons.json', JSON.stringify(beacons))
  fs.writeFileSync('drops.json', JSON.stringify(drops))
  fs.writeFileSync('comments.json', JSON.stringify(comments))
  log('\Finished\n')
  process.exit(0)
}
