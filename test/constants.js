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
  commentId = _schemas.comment.id + '.' + timeStamp + '.000001',
  placeId = _schemas.place.id + '.' + timeStamp + '.000001',
  postId = _schemas.post.id + '.' + timeStamp + '.000001',
  documentId = _schemas.document.id + '.' + timeStamp + '.000001',
  linkId = _schemas.link.id + '.'  + timeStamp + '.000001',
  latitude = 47,                                              // Nearby
  longitude = -122,
  password = 'password',
  limit = 1000,
  defaultDoc = {},
  dbProfile = {
    smokeTest: {
      users: 10,
      beacons: 10,
      epb: 1,       // place entities per beacon
      spe: 5,       // post entities per place entity
      ape: 5,       // applinks per place
      cpe: 2,       // comment entities per place and post entity
      likes: 2,
      watch: 2,
      database: 'smokeData',
    },
    perfTest: {
      users: 10,
      beacons: 10,
      epb: 1,       // place entities per beacon
      spe: 5,       // post entities per place entity
      ape: 5,       // applinks per place
      cpe: 2,       // comment entities per place and post entity
      likes: 2,
      watch: 2,
      database: 'perfTest',
    }
  }


defaultDoc.user = defaultDoc.users1 = {
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

defaultDoc.user2 = {
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

defaultDoc.place = {
  _id: placeId,
  name: 'Museum of Modern Art',
  subtitle: 'Contemporary Galleries: 1980-Now',
  description: 'The Museum of Modern Art is a place that fuels creativity, ignites minds, and provides inspiration. With extraordinary exhibitions and the world\'s finest collection of modern and contemporary art, MoMA is dedicated to the conversation between the past and the present, the established and the experimental. Our mission is helping you understand and enjoy the art of our time.',
  photo: { prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg", source:"aircandi" },
  signalFence: -100,
  location: { lat:latitude, lng:longitude, altitude:0, accuracy:30, speed: 0, geometry:[longitude, latitude] },
  address:"123 Central Park", city:"New York", region:"NY", country:"USA", // phone:"2065551212",
  // provider:{
  //  foursquare:"4bcfbae19854d13a82b8f64d"
  // },
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

defaultDoc.applink = {
  _id: applinkId,
  type: 'foursquare',
  name: "Bannerwood Park",
  photo: { prefix:"https://graph.facebook.com/143970268959049/picture?type=large", source:"facebook" },
  appId: "143970268959049",
  appUrl: "https://www.facebook.com/pages/Bannerwood-Park/143970268959049",
  data: { origin : "facebook", validated : 1369167109174.0, likes : 9 },
  _creator: uid1,
}

defaultDoc.post = {
  _id: postId,
  name: 'Mona Lisa',
  subtitle: 'Leonardo daVinci',
  description: 'Mona Lisa (also known as La Gioconda or La Joconde) is a 16th-century portrait painted in oil on a poplar panel by Leonardo di ser Piero da Vinci during the Renaissance in Florence, Italy.',
  photo: {prefix:"https://s3.amazonaws.com/3meters_images/test_preview.jpg"},
  _creator: uid1,
}

defaultDoc.comment = {
  _id: commentId,
  name: 'Hmmm, not sure what the fuss is',
  description: 'Stuck behind thick plexiglass, tiny, I could hardly see it.',
  _creator: uid1,
}

defaultDoc.link = {
  _id: linkId,
  _to : placeId,
  _from : postId
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
  commentId: commentId,
  placeId: placeId,
  postId: postId,
  latitude: latitude,
  longitude: longitude,
  timeStamp: timeStamp,
  timeStampMs: timeStampMs,
  limit: limit,
  dbProfile: util._.clone(dbProfile)
}

module.exports.getDefaultDoc = function(schema) {
  assert(defaultDoc[schema], 'No default doc for ' + schema)
  return util.clone(defaultDoc[schema])
}

