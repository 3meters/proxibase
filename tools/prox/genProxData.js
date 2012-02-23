/*
 * Create dummy datafiles to load into prox
 */

var
  cBeacons = 1,  // change to add more data
  fs = require('fs'),
  log = require('../../lib/log'),
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

function genId(tableId, seed) {
  var s = seed.toString()
  if (s < 10) s = '0' + s
  return '000' + tableId.toString() + '.100101.55555.000.0000' + s
}

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
    name: '99:99:00:00:00:' + s,
    ssid: 'Test Beacon ' + iBeacon.toString()
  }
  for (var i = 3; i--;) {
    var entityId = genId(entityModelId, ((iBeacon * 5) + (i * 5)) )
    var dropId = genId(dropModelId, (iBeacon * 5) + i)
    drops.push({
      _id: dropId,
      _owner: jid,
      _creator: jid,
      _modifier: jid,
      _entity: entityId,
      _beacon: beaconId
    })
  }
  genBeacon(iBeacon, iTbl, cb)
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
  if (parentId != iEntity) entities[iEntity]._parent = genId(entityModelId, parentId)

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

function done() {
  fs.writeFileSync('entities.json', JSON.stringify(entities))
  fs.writeFileSync('beacons.json', JSON.stringify(beacons))
  fs.writeFileSync('drops.json', JSON.stringify(drops))
  fs.writeFileSync('comments.json', JSON.stringify(comments))
  log('\Finished\n')
  process.exit(0)
}
