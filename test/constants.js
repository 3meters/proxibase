/*
 * Provide shared data constants for tests and tools
 */

var
  assert = require('assert'),
  _ = require('underscore'),                                  // For cloning objects
  timeStamp = '010101.00000.555',                             // Jan 1 2000 + 555 miliseconds
  timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()  // Same but in milliseconds
  uid1 = '0001.' + timeStamp + '.000001',                     // Standard user
  uid2 = '0001.' + timeStamp + '.000002',                     // Dev user
  bssid = '00:00:00:00:00:01',
  beaconId = '0008.' + bssid,
  entityId = '0004.' + timeStamp + '.000001',
  childEntityId = '0004.' + timeStamp + '.000501',
  documentId = '0007.' + timeStamp + '.000001',
  linkId = '0005.' + timeStamp + '.000001',
  latitude = 47,                                              // Nearby
  longitude = -122,
  password = 'password',
  tableIds = {
    users: '0001',
    links: '0005',
    entities: '0004',
    beacons: '0008',
    documents: '0007'
  },
  recordLimit = 1000,
  defaultRecord = {},
  dbProfile = {
    smokeTest: {
      users: 10,
      beacons: 100,
      epb: 5,
      spe: 5,
      cpe: 5,
      database: 'smokeData'
    }
  }

// Add system properties
function addSystemFields(record) {
  record.createdDate = timeStampMs
  record.modifiedDate = timeStampMs
}

defaultRecord.users = defaultRecord.users1 = {
  _id: uid1,
  name: 'Test User',
  email: 'test@3meters.com',
  location: 'Testville, WA',
  developer: false
}

defaultRecord.users2 = {
  _id: uid2,
  name: 'Test User Dev',
  email: 'testdev@3meters.com',
  location: 'Testville, WA',
  password: password,
  developer: true
}

defaultRecord.documents = {
  _id: documentId,
  name : 'aircandi',
  type : 'version',
  data: {
    major : 0,
    minor : 1,
    revision : 100,
    updateRequired : true,
    versionCode : 1,
    versionName : '0.01.0100'
  }
}

var comment = {
  _creator: uid1,
  title : 'Worth the trip',
  description : 'Everyone makes a big fuss about it so I figured a letdown was inevitable but wow!',
  name : 'Test User',
  location : 'Testville, WA',
  createdDate : timeStampMs
}

defaultRecord.beacons = {
  _id: beaconId,
  label: 'Test Beacon Label',
  ssid: 'Test Beacon',
  bssid: bssid,
  beaconType: 'fixed',
  visibility: 'public',
  accuracy : 30,
  altitude : 0,
  latitude : latitude,
  longitude : longitude,
  speed : 0,
  loc : [longitude, latitude]
}

defaultRecord.entities = {
  _id: entityId,
  type: util.statics.typeContent,
  name: 'Mona Lisa',
  subtitle: 'Leonardo daVinci',
  description: 'Mona Lisa (also known as La Gioconda or La Joconde) is a 16th-century portrait painted in oil on a poplar panel by Leonardo di ser Piero da Vinci during the Renaissance in Florence, Italy.',
  signalFence: -100,
  comments: [
    comment,
    comment,
    comment,
    comment,
    comment
  ],
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg"},
  place: {lat:latitude,lng:longitude},
  visibility: 'public',
  enabled: true,
  locked: false
}

defaultRecord.links = {
  _id: linkId,
  toCollectionId : tableIds['beacons'],
  fromCollectionId : tableIds['entities'],
  _to : beaconId,
  _from : entityId
}

for (tableName in defaultRecord) {
  addSystemFields(defaultRecord[tableName])
}

// Remeber to _.clone() all exported objects!
module.exports = {
  uid1: uid1,
  uid2: uid2,
  password: password,
  beaconId: beaconId,
  entityId: entityId,
  childEntityId: childEntityId,
  documentId: documentId,
  linkId: linkId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  recordLimit: recordLimit,
  tableIds: _.clone(tableIds),
  comment: _.clone(comment),
  dbProfile: _.clone(dbProfile)
}
module.exports.getDefaultRecord = function(tableName) {
  assert(defaultRecord[tableName], 'No default record for ' + tableName)
  return _.clone(defaultRecord[tableName])
}

