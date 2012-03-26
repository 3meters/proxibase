/*
 * Generate dummy data to files or directly to a mongo server
 */

var
  fs = require('fs'),
  path = require('path'),
  async = require('async'),
  mongoskin = require('mongoskin'),  
  log = require('../../lib/util').log,
  constants = require('../../test/constants.js'),
  tableIds = constants.tableIds,
  timeStamp = constants.timeStamp,
  getDefaultRecord = constants.getDefaultRecord,
  comments = constants.comments,
  users = [],
  documents = [],
  observations = [],
  beacons = [],
  entities = [],
  links = [],
  profile,
  db

module.exports.generateData = function(dataProfile) {
  profile = dataProfile

  if (profile.files) {
    log('Saving to files...')
    run(profile)
  }
  else {
    /* 
     * Our own connection so we don't need to have proxibase service running.
     * Database will be created if it doesn't already exist.
     */
    var config = require('../../conf/config') // this could get better
    config.mdb.database = profile.database
    var connectString = config.mdb.host + ':' + config.mdb.port +  '/' + config.mdb.database + '?auto_reconnect'
    db = mongoskin.db(connectString)
    log('Saving directly to database: ' + connectString)
    run(profile)
  }
}

function run(profile) {

  // see https://github.com/caolan/async#series
  async.series([
    genUsers(done),
    genDocuments(done),
    genBeacons(profile.beacons, done),
    genEntities(profile.beacons * profile.epb, true, done), // parents
    genEntities(profile.beacons * profile.epb * profile.cpe, false, done), // children
    saveEntities(done)
  ],
  function(err, results) {
    console.log('Finished')
    process.exit(0)
  })

  function done(err) {
    return(err, null) // no results to post-process
  }
}

function genUsers(callback) {
  users.push(getDefaultRecord('users1'))
  users.push(getDefaultRecord('users2'))
  save(users, 'users', function(err) {
    if (err) return callback(err)
    log('saved ' + users.length + ' users')
    return callback()
  })
}

function genDocuments(callback) {
  documents.push(getDefaultRecord('documents'))
  save(documents, 'documents', function(err) {
    if (err) return callback(err)
    log('saved ' + documents.length + ' documents')
    return callback()
  })
}

function genBeaconId(recNum) {
  var id = pad(recNum + 1, 12)
  id = delineate(id, 2, ':')
  var prefix = pad(tableIds.beacons, 4) + ':' // TODO: change to '.'
  return  prefix + id
}


function genBeacons(count, callback) {
  for (var i = 0; i < count; i++) {
    var beacon = getDefaultRecord('beacons')
    beacon._id = genBeaconId(i)
    beacon.ssid = beacon.ssid + ' ' + i
    beacon.bssid = beacon._id.substring(5)
    beacons.push(beacon)
  }
  save(beacons, 'beacons', function(err) {
    if (err) return callback(err)
    log('saved ' + beacons.length + ' beacons')
    return callback()
  })
}

function genEntities(count, isRoot, callback) {
  var countParents = profile.beacons * profile.epb // child Ids start after parent Ids

  for (var i = 0; i < count; i++) {
    var 
      newEnt = getDefaultRecord('entities'),
      recNum = isRoot ? i : i + countParents,
      beaconNum = Math.floor(i / profile.epb)

    newEnt._id = genId('entities', recNum)
    newEnt.root = isRoot
    newEnt.label = newEnt.title = isRoot ? newEnt.title + ' ' + recNum : newEnt.title + ' Child ' + recNum
    entities.push(newEnt)

    /* Link */
    newLink = getDefaultRecord('links')
    newLink._id = genId('links', recNum)
    newLink._from = newEnt._id
    newLink.fromTableId = tableIds['entities']
    if (isRoot) {
      // create link to beacon
      newLink._to = genBeaconId(beaconNum)
      newLink.toTableId = tableIds['beacons']
    }
    else {
      // create link to parent entity
      var parentRecNum = Math.floor(i / profile.cpe) // yeah, this is right
      newLink._to = genId('entities', parentRecNum)
      newLink.toTableId = tableIds['entities']
    }
    links.push(newLink)

    /* Observation */
    var newObservation = getDefaultRecord('observations')
    newObservation._id = genId('observations', recNum)
    newObservation._beacon = genBeaconId(beaconNum)
    newObservation._entity = newEnt._id
    observations.push(newObservation)

    /* Comments */
    newEnt.comments = []
    for (var j = 0; j < profile.cpe; j++) {
      newEnt.comments.push(comments)
    }
  }
  return callback()
}

function saveEntities(callback) {
  save(entities, 'entities', function(err) {
    if (err) return callback(err)
    log('saved ' + entities.length + ' entities') // + ((isRoot) ? ' parent' : ' child') + ' enities')

    save(links, 'links', function(err) {
      if (err) return callback(err)
      log('saved ' + links.length + ' links')  // + ((isRoot) ? ' beacon' : ' parent') + ' links')

      save(observations, 'observations', function(err) {
        if (err) return callback(err)
        log('saved ' + observations.length + ' observations')  // + ((isRoot) ? ' beacon' : ' parent') + ' links')
        return callback()
      })
    })
  })
}

// create a digits-length string from number left-padded with zeros
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

// make a standard _id field for a table with recNum as the last id element
function genId(tableName, recNum) {
  assert((typeof tableIds[tableName] === 'number'), 'Invalid table name ' + tableName)
  tablePrefix = pad(tableIds[tableName], 4)
  recNum = pad(recNum + 1, 6)
  return tablePrefix + '.' + timeStamp + '.' + recNum
}

// save either to a file or to the database
function save(table, name, callback) {
  if (profile.files) {
    if (!path.existsSync(profile.out)) fs.mkdirSync(profile.out)
    fs.writeFileSync(profile.out + '/' + name + '.json', JSON.stringify(table))
    return callback()
  }
  else {
    db.createCollection(name, function(err, collection) {
      if (err) return callback(err)
      collection.remove({}, {safe: true}, function(err, count) {
        if (err) return callback(err)
        collection.insert(table, {safe: true}, function(err, docs) {
          if (err) return callback(err)
          return callback()
        })
      })
    })
  }
}