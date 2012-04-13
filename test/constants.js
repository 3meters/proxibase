/*
 * Provide shared data constants for tests and tools
 */

var
  _ = require('underscore'),                                  // For cloning objects
  timeStamp = '010101.00000.555',                             // Jan 1 2000 + 555 miliseconds
  timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()  // Same but in milliseconds
  uid1 = '0000.' + timeStamp + '.000001',                     // Standard user
  uid2 = '0000.' + timeStamp + '.000002',                     // Dev user
  bssid = '00:00:00:00:00:01',
  beaconId = '0003:' + bssid,                                 // TODO: Change : to .
  entityId = '0002.' + timeStamp + '.000001',
  documentId = '0005.' + timeStamp + '.000001',
  observationId = '0007.' + timeStamp + '.000001',
  linkId = '0001.' + timeStamp + '.000001',
  latitude = 47,                                              // Nearby
  longitude = -122,
  password = 'password',
  tableIds = {
    users: 0,
    links: 1,
    entities: 2,
    beacons: 3,
    documents: 5,
    observations: 7
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
  email: 'testuser@3meters.com',
  imageUri: 'https://s3.amazonaws.com/3meters_images/test_user1.jpg',
  location: 'Testville, WA',
  password: password,
  isDeveloper: false
}

defaultRecord.users2 = {
  _id: uid2,
  name: 'Test User Dev',
  email: 'testdev@3meters.com',
  imageUri: 'https://s3.amazonaws.com/3meters_images/test_user2.jpg',
  location: 'Testville, WA',
  password: password,
  isDeveloper: true
}

defaultRecord.documents = {
  _id: documentId,
  major : 0,
  minor : 1,
  revision : 100,
  target : 'aircandi',
  type : 'version',
  updateRequired : true,
  versionCode : 1,
  versionName : '0.01.0100'
}

comments = {
  title : 'Worth the trip',
  description : 'Everyone makes a big fuss about it so I figured a letdown was inevitable but wow!',
  imageUri : 'https://s3.amazonaws.com/3meters_images/test_user1.jpg',
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
  type: 'com.proxibase.aircandi.candi.picture',
  label: 'Mona Lisa',
  title: 'Mona Lisa',
  subtitle: 'Leonardo daVinci',
  description: 'Mona Lisa (also known as La Gioconda or La Joconde) is a 16th-century portrait painted in oil on a poplar panel by Leonardo di ser Piero da Vinci during the Renaissance in Florence, Italy.',
  signalFence: -100,
  comments: [ 
    comments,
    comments,
    comments,
    comments,
    comments
  ],
  imagePreviewUri: 'https://s3.amazonaws.com/3meters_images/test_preview.jpg',
  imageUri: 'https://s3.amazonaws.com/3meters_images/test_preview.jpg',
  linkJavascriptEnabled: false,
  linkZoom: false,
  visibility: 'public',
  enabled: true,
  locked: false,
  root: root
}

defaultRecord.observations = {
  _id: observationId,
  _beacon : beaconId,
  _entity : entityId,
  accuracy : 30,
  altitude : 0,
  latitude : latitude,
  longitude : longitude,
  speed : 0,
  loc : [longitude, latitude]
}

defaultRecord.links = {
  _id: linkId,
  toTableId : tableIds['beacons'],
  fromTableId : tableIds['entities'],
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
  documentId: documentId,
  observationId: observationId,
  linkId: linkId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  recordLimit: recordLimit,
  tableIds: _.clone(tableIds),
  comments: _.clone(comments),
  dbProfile: _.clone(dbProfile)
}
module.exports.getDefaultRecord = function(tableName) {
  assert(defaultRecord[tableName], 'No default record for ' + tableName)
  return _.clone(defaultRecord[tableName])
}

