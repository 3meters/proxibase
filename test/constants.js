/*
 * Provide shared data constants for tests and tools
 */


var util = require('proxutils')
var assert = require('assert')
var timeStamp = '010101.00000.555'                             // Jan 1 2000 + 555 miliseconds
var timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()  // Same but in milliseconds
var _schemas = util.statics.schemas
var uid1 = _schemas.user.id + '.' + timeStamp + '.000001'                     // Standard user
var uid2 = _schemas.user.id + '.' + timeStamp + '.000002'                     // Dev user
var bssid = '00:00:00:00:00:01'
var beaconId = _schemas.beacon.id + '.' + bssid
var patchId = _schemas.patch.id + '.' + timeStamp + '.000001'
var placeId = _schemas.place.id + '.' + timeStamp + '.000001'
var messageId = _schemas.message.id + '.' + timeStamp + '.000001'
var documentId = _schemas.document.id + '.' + timeStamp + '.000001'
var linkId = _schemas.link.id + '.'  + timeStamp + '.000001'
var latitude = 40.761449                                              // Manhatten
var longitude = -73.977341
var password = 'password'
var limit = 1000
var defaultDoc = {}
var dbProfile = {
  smokeTest: {
    users: 10,
    ppu: 5,   // patches per user
    bpp: 5,   // beacons per patch
    ppp: 1,   // places per patch
    mpp: 5,   // messages per patch
  },
}


defaultDoc.user = defaultDoc.users1 = {
  _id: uid1,
  name: 'Test User',
  email: 'test@3meters.com',
  photo: {
    prefix:"resource:patchholder_user",
    source:"resource",
  },
  area: 'Testville, WA',
  developer: false,
}

defaultDoc.user2 = {
  _id: uid2,
  name: 'Test User Dev',
  email: 'testdev@3meters.com',
  photo: {
    prefix:"resource:patchholder_user",
    source:"resource",
  },
  area: 'Testville, WA',
  password: password,
  developer: true,
}

defaultDoc.document = {
  _id: documentId,
  type : 'version',
  data: {
    androidMinimumVersion:10
  },
}

defaultDoc.beacon = {
  _id: beaconId,
  name: 'Beacon',
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  ssid: 'Test Beacon',
  bssid: bssid,
  signal: -80,
  _creator: uid1,
}

defaultDoc.patch = {
  _id: patchId,
  name: 'Test Patch',
  category: {
    id: 'testCategory',
    name: 'Test Categegory'
  }
}

defaultDoc.place = {
  _id: placeId,
  name: 'Test Place',
  category: {
    id: 'testCategory',
    name: 'Test Categegory'
  }
}

defaultDoc.message = {
  _id: messageId,
  name: 'Message',
  description: 'Hey, check out my cool message to everyone here',
  photo: {
    prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg",
    source:"generic"
  },
  _creator: uid1,
}



// Remeber to _.clone() all exported objects!
module.exports = {
  uid1: uid1,
  uid2: uid2,
  password: password,
  documentId: documentId,
  linkId: linkId,
  bssid: bssid,
  beaconId: beaconId,
  patchId: patchId,
  placeId: placeId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  limit: limit,
  dbProfile: util.clone(dbProfile)
}

module.exports.getDefaultDoc = function(schema) {
  assert(defaultDoc[schema], 'No default doc for ' + schema)
  return util.clone(defaultDoc[schema])
}

