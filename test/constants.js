/*
 * Provide shared data constants for tests and tools
 */

var
  util = require('proxutils')
  assert = require('assert'),
  timeStamp = '010101.00000.555',                             // Jan 1 2000 + 555 miliseconds
  timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()  // Same but in milliseconds
  _schemas = util.statics.schemas
  uid1 = _schemas.user.id + '.' + timeStamp + '.000001',                     // Standard user
  uid2 = _schemas.user.id + '.' + timeStamp + '.000002',                     // Dev user
  bssid = '00:00:00:00:00:01',
  beaconId = _schemas.beacon.id + '.' + bssid,
  applinkId = _schemas.applink.id + '.' + timeStamp + '.000001',
  patchId = _schemas.patch.id + '.' + timeStamp + '.000001',
  placeId = _schemas.place.id + '.' + timeStamp + '.000001',
  messageId = _schemas.message.id + '.' + timeStamp + '.000001',
  documentId = _schemas.document.id + '.' + timeStamp + '.000001',
  linkId = _schemas.link.id + '.'  + timeStamp + '.000001',
  latitude = 40.761449,                                              // Manhatten
  longitude = -73.977341
  password = 'password',
  limit = 1000,
  defaultDoc = {},
  dbProfile = {
    smokeTest: {
      users: 10,
      ppu: 5,   // patches per user
      bpp: 5,   // beacons per patch
      ppp: 1,   // places per patch
      mpp: 5,    // messages per patch
      app: 5,   // applinks per patch
      database: 'smokeData',
    },
    perfTest: {
      users: 1000,
      ppu: 5,
      bpp: 5,
      ppp: 1,
      mpp: 5,
      app: 5,
      database: 'perf',
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
}

defaultDoc.place = {
  _id: placeId,
  name: 'Test Place',
}

defaultDoc.applink = {
  _id: applinkId,
  type: 'website',
  name: "My applink",
  appId: "http://www.google.com",
  appUrl: "http://www.google.com",
  origin: 'aircandi'  // user-created
}

defaultDoc.message = {
  _id: messageId,
  name: 'Message',
  description: 'Hey, check out my cool message to everyone here',
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg"},
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
  applinkId: applinkId,
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

