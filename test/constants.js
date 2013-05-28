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
  entityId = '0004.' + timeStamp + '.000101',
  bssid = '00:00:00:00:00:01',
  beaconId = '0004.' + bssid,
  documentId = '0007.' + timeStamp + '.000001',
  linkId = '0005.' + timeStamp + '.000001',
  latitude = 47,                                              // Nearby
  longitude = -122,
  password = 'password',
  tableIds = {
    users: '0001',
    entities: '0004',
    links: '0005',
    beacons: '0008',
    documents: '0007'
  },
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

defaultRecord.entities_beacon = {
  _id: entityId,
  type: util.statics.typeBeacon,
  name: 'Beacon',
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  beacon: { 
    ssid: 'Test Beacon',
    bssid: bssid,
    signal: -80,
  },
  _creator: uid1,
}

defaultRecord.entities_place = {
  _id: entityId,
  type: util.statics.typePlace,
  name: 'Museum of Modern Art',
  subtitle: 'Contemporary Galleries: 1980-Now',
  description: 'The Museum of Modern Art is a place that fuels creativity, ignites minds, and provides inspiration. With extraordinary exhibitions and the world\'s finest collection of modern and contemporary art, MoMA is dedicated to the conversation between the past and the present, the established and the experimental. Our mission is helping you understand and enjoy the art of our time.',
  photo: { prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg", source:"aircandi" },
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  place: { 
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
    }
  },
  signalFence: -100,
  _creator: uid1,
}

defaultRecord.entities_applink = {
  _id: entityId,
  type: util.statics.typeApplink,
  name: "Bannerwood Park",
  photo: { prefix:"https://graph.facebook.com/143970268959049/picture?type=large", source:"facebook" },
  applink: {
    type: 'foursquare',
    id: "143970268959049",
    url: "https://www.facebook.com/pages/Bannerwood-Park/143970268959049",
  },
  sdata: { origin : "facebook", validated : 1369167109174.0, likes : 9 },
  _creator: uid1,
}

defaultRecord.entities_post = {
  _id: entityId,
  type: util.statics.typePost,
  name: 'Mona Lisa',
  subtitle: 'Leonardo daVinci',
  description: 'Mona Lisa (also known as La Gioconda or La Joconde) is a 16th-century portrait painted in oil on a poplar panel by Leonardo di ser Piero da Vinci during the Renaissance in Florence, Italy.',
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg"},
  _creator: uid1,
}

defaultRecord.entities_comment = {
  _id: entityId,
  type: util.statics.typeComment,
  name: 'Hmmm, not sure what the fuss is',
  description: 'Stuck behind thick plexiglass, tiny, I could hardly see it.',
  _creator: uid1,
}

defaultRecord.links = {
  _id: linkId,
  toCollectionId : tableIds['entities'],
  fromCollectionId : tableIds['entities'],
  _to : entityId,
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
  entityId: entityId,
  bssid: bssid,
  beaconId: beaconId,
  documentId: documentId,
  linkId: linkId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  recordLimit: recordLimit,
  tableIds: _.clone(tableIds),
  dbProfile: _.clone(dbProfile)
}

module.exports.getDefaultRecord = function(tableName) {
  assert(defaultRecord[tableName], 'No default record for ' + tableName)
  return _.clone(defaultRecord[tableName])
}

