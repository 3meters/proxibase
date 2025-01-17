/*
 * migrate proxibase database from version 1 to version 2
 *
 * reads json files from ./old containing all data from version 1
 * writes json files to ./new containing all transformed data for verstion 2
 *
 * Since this is a file-to-file transform, all calls are synchronous
 *
 */


var
  fs = require('fs'),
  _baseUri = 'https://api.localhost:8043',
  baseUri = 'https://api.proxibase.com:443',
  req = require('request'),
  tables = {
    'users': { id: 0 },
    'links': { id: 1 },
    'entities': { id: 2 },
    'beacons': { id: 3 },
    'drops': { id: 33 },
    'comments': { id: 4 },
    'documents': { id: 5 },
    'beaconsets': { id: 6 },
    'observations': { id: 7 }
  },
  tableArray = []


function getRecById(tableName, id) {
  var result = null
  tables[tableName].data.forEach(function(row) {
    if (row['_id'] === id) {
      result = row
      return
    }
  })
  return result
}

function makeNewBeaconId(beacon) {
  return '0003:' + beacon.bssid
}

function copySysFields(oldRec, newRec) {
  newRec._owner = oldRec._owner,
  newRec._creator = oldRec._creator,
  newRec._modifier = oldRec._modifier,
  newRec.createdDate = oldRec.createdDate,
  newRec.modifiedDate = oldRec.modifiedDate
}

// read all .json files in the ./old directory and parse them into .data arrays on the table objects 
function read() {
  for (var tableName in tables) {
    try {
      var json = fs.readFileSync('./old/' + tableName + '.json', 'utf8')
      tables[tableName].data = JSON.parse(json)
    } catch (e) {
      console.error('Could not read or parse ./old/' + tableName + ', skipping')
    }
  }
}

function transform() {

  tables.links.data = []
  tables.observations.data = []

  tables.entities.data.forEach(function(ent) {
    // if ent is a child, create a new link record to parent
    if (ent._entity) {
      var link = {
        _from: ent._id,
        _to: ent._entity
      }
      copySysFields(ent, link)
      tables.links.data.push(link)
    }
    delete ent._entity
  })

  tables.drops.data.forEach(function(drop) {

    // create a new link record with the new keyformat of the beacons table
    var beacon = getRecById('beacons', drop._beacon)
    if (!beacon) { 
      console.log('Cannot find beacon ' + drop._beacon + '  skipping...')
      return // missing beacon, skip 
    }
    var newBeaconId = makeNewBeaconId(beacon)

    var link = {
      _from: drop._entity,
      _to: newBeaconId
    }
    copySysFields(drop, link)
    tables.links.data.push(link)

    var observation = {
      _beacon: newBeaconId,
      _entity: drop._entity,  // yuk
      latitude: drop.latitude,
      longitude: drop.longitude,
      altitude: drop.altitude,
      speed: drop.speed,
      accuracy: drop.accuracy
    }
    copySysFields(drop, observation)
    tables.observations.data.push(observation)
  })

  delete tables.drops

  tables.beacons.data.forEach(function(bcn) {
    bcn._id = makeNewBeaconId(bcn)
    delete bcn.bssid
  })

}


// write the transformed, in-memory tables to json files for loading to the transformed server
function write() {
  for(var tableName in tables) {
    fs.writeFileSync('./new/' + tableName + '.json', JSON.stringify(tables[tableName].data))
  }
}


read()
transform()
write()
process.exit(0)


