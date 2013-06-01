/*
 * Provide shared data constants for tests and tools
 */

var
  assert = require('assert'),
  _ = require('underscore'),                                  // For cloning objects
  timeStamp = '010101.00000.555',                             // Jan 1 2000 + 555 miliseconds
  timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()  // Same but in milliseconds
  uid1 = util.statics.collectionIds.users + '.' + timeStamp + '.000001',                     // Standard user
  uid2 = util.statics.collectionIds.users + '.' + timeStamp + '.000002',                     // Dev user
  bssid = '00:00:00:00:00:01',
  beaconId = util.statics.collectionIds.beacons + '.' + bssid,
  applinkId = util.statics.collectionIds.applinks + '.' + timeStamp + '.000001',
  commentId = util.statics.collectionIds.comments + '.' + timeStamp + '.000001',
  placeId = util.statics.collectionIds.places + '.' + timeStamp + '.000001',
  postId = util.statics.collectionIds.posts + '.' + timeStamp + '.000001',
  documentId = util.statics.collectionIds.documents + '.' + timeStamp + '.000001',
  linkId = util.statics.collectionIds.links + '.'  + timeStamp + '.000001',
  deviceId = util.statics.collectionIds.devices + '.'  + timeStamp + '.000001',
  registrationId = 'a1a1a1a1a1',
  latitude = 47,                                              // Nearby
  longitude = -122,
  password = 'password',
  recordLimit = 1000,
  defaultRecord = {},
  dbProfile = {
    smokeTest: {
      users: 10,
      beacons: 100,
      epb: 5,       // place entities per beacon
      spe: 5,       // post entities per place entity
      ape: 5,       // applinks per place
      cpe: 5,       // comment entities per place and post entity
      likes: 5,
      watch: 2,
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
  type: util.statics.typeUser,
  name: 'Test User',
  email: 'test@3meters.com',
  photo: { 
    prefix:"resource:placeholder_user", 
    source:"resource",
  },
  area: 'Testville, WA',
  developer: false,
}

defaultRecord.users2 = {
  _id: uid2,
  name: 'Test User Dev',
  email: 'testdev@3meters.com',
  photo: { 
    prefix:"resource:placeholder_user", 
    source:"resource",
  },
  area: 'Testville, WA',
  password: password,
  developer: true,
}

defaultRecord.documents = {
  _id: documentId,
  type : 'com.aircandi.document.version',
  data: {
    androidMinimumVersion:10
  },
}

defaultRecord.beacons = {
  _id: beaconId,
  type: util.statics.typeBeacon,
  name: 'Beacon',
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  ssid: 'Test Beacon',
  bssid: bssid,
  signal: -80,
  _creator: uid1,
}

defaultRecord.places = {
  _id: placeId,
  type: util.statics.typePlace,
  name: 'Museum of Modern Art',
  subtitle: 'Contemporary Galleries: 1980-Now',
  description: 'The Museum of Modern Art is a place that fuels creativity, ignites minds, and provides inspiration. With extraordinary exhibitions and the world\'s finest collection of modern and contemporary art, MoMA is dedicated to the conversation between the past and the present, the established and the experimental. Our mission is helping you understand and enjoy the art of our time.',
  photo: { prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg", source:"aircandi" },
  signalFence: -100,
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  address:"123 Central Park", city:"New York", region:"NY", country:"USA", phone:"2065551212", 
  provider:{ 
    foursquare:"4bcfbae19854d13a82b8f64d" 
  },
  category:{ 
    id:"4bf58dd8d48988d18c941735", 
    name : "Baseball Stadium",
    photo:{
      prefix : "/img/categories/foursquare/4bf58dd8d48988d18c941735_88.png",
      source : "assets.categories",
    },
  },
  _creator: uid1,
}

defaultRecord.applinks = {
  _id: applinkId,
  type: 'foursquare',
  name: "Bannerwood Park",
  photo: { prefix:"https://graph.facebook.com/143970268959049/picture?type=large", source:"facebook" },
  appId: "143970268959049",
  url: "https://www.facebook.com/pages/Bannerwood-Park/143970268959049",
  data: { origin : "facebook", validated : 1369167109174.0, likes : 9 },
  _creator: uid1,
}

defaultRecord.posts = {
  _id: postId,
  type: util.statics.typePost,
  name: 'Mona Lisa',
  subtitle: 'Leonardo daVinci',
  description: 'Mona Lisa (also known as La Gioconda or La Joconde) is a 16th-century portrait painted in oil on a poplar panel by Leonardo di ser Piero da Vinci during the Renaissance in Florence, Italy.',
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg"},
  _creator: uid1,
}

defaultRecord.comments = {
  _id: commentId,
  type: util.statics.typeComment,
  name: 'Hmmm, not sure what the fuss is',
  description: 'Stuck behind thick plexiglass, tiny, I could hardly see it.',
  _creator: uid1,
}

defaultRecord.links = {
  _id: linkId,
  _to : placeId,
  _from : postId
}

for (tableName in defaultRecord) {
  addSystemFields(defaultRecord[tableName])
}

// Remeber to _.clone() all exported objects!
module.exports = {
  uid1: uid1,
  uid2: uid2,
  password: password,
  documentId: documentId,
  deviceId: deviceId,
  linkId: linkId,
  bssid: bssid,
  beaconId: beaconId,
  applinkId: applinkId,
  commentId: commentId,
  placeId: placeId,
  postId: postId,
  registrationId: registrationId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  recordLimit: recordLimit,
  dbProfile: _.clone(dbProfile)
}

module.exports.getDefaultRecord = function(tableName) {
  assert(defaultRecord[tableName], 'No default record for ' + tableName)
  return _.clone(defaultRecord[tableName])
}

