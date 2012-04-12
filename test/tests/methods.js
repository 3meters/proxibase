
/*
 *  Proxibase custom methods test
 */

var
  request = require('request'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  constants = require('../constants'),  
  dbProfile = constants.dbProfile.smokeTest,
  baseUri = testUtil.serverUrl,
  req = testUtil.getDefaultReq(),
  testLatitude = 50,
  testLongitude = 50,
  testUser = {
    _id : "0000.111111.11111.111.111111",
    name : "John Q Test",
    email : "johnqtest@3meters.com",
    password : "12345678",
    imageUri : "resource:placeholder_user",
    location : "Testville, WA",
    isDeveloper : false
  },
  testEntity = {
    _id : "0002.111111.11111.111.111111",
    imagePreviewUri : "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    imageUri : "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    label : "Testing candi",
    signalFence : -100,
    title : "Testing candi",
    type : "com.proxibase.aircandi.candi.picture",
    visibility : "public",
    enabled : true,
    locked : false,
    linkJavascriptEnabled : false,
    linkZoom : false,
    root : true
  },
  testBeacon = {
    _id : '0003:11:11:11:11:11:11',
    label: 'Test Beacon Label',
    ssid: 'Test Beacon',
    bssid: '11:11:11:11:11:11',
    beaconType: 'fixed',
    visibility: 'public',
    accuracy : 30,
    altitude : 0,
    latitude : testLatitude,
    longitude : testLongitude,
    speed : 0,
    loc : [testLongitude, testLatitude]
  },
  testComment = {
      title : "Test Comment",
      description : "Test comment, much ado about nothing.",
      name : "John Q Test",
      location : "Testville, WA",
      imageUri : "resource:placeholder_user",
      _creator : testUser._id
  }


// get version info and also make sure the server is responding
exports.lookupVersion = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'documents',find:{type:'version',target:'aircandi'}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

/* housekeeping */
exports.cleanupUser = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/users/__ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

/* housekeeping */
exports.cleanupEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,deleteChildren:false})
  req.uri = baseUri + '/__do/deleteEntity'
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

/* housekeeping */
exports.cleanupBeacon = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/beacons/__ids:' + testBeacon._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.insertUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({data:testUser})
  req.uri = baseUri + '/users'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id && res.body.data._id === testUser._id, dump(req, res))
    test.done()
  })
}

exports.signinUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'users',find:{email:'johnqtest@3meters.com'}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.updateUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({data:{location:'Testburg, WA'}})
  req.uri = baseUri + '/users/__ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data.location && res.body.data.location === 'Testburg, WA', dump(req, res))    
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/users/__ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].location === 'Testburg, WA', dump(req, res))
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.method = 'delete'
  req.uri = baseUri + '/users/__ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.getEntities = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityIds:[constants.entityId],eagerLoad:{children:true,comments:true}})
  req.uri = baseUri + '/__do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0], dump(req, res))
    var record = res.body.data[0]
    assert(record.children.length === dbProfile.spe, dump(req, res))
    assert(record.childrenCount === dbProfile.spe, dump(req, res))
    assert(record.comments.length === dbProfile.cpe, dump(req, res))
    assert(record.commentsCount === dbProfile.cpe, dump(req, res))
    assert(record._beacon === constants.beaconId, dump(req, res))
    assert(record.location, dump(req, res))
    assert(record.location.latitude, dump(req, res))
    assert(record.location.longitude, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeacons = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({beaconIds:[constants.beaconId],eagerLoad:{children:true,comments:false}})
  req.uri = baseUri + '/__do/getEntitiesForBeacons'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === dbProfile.epb, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({userId:constants.uid1, eagerLoad:{children:false,comments:false}})
  req.uri = baseUri + '/__do/getEntitiesForUser'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === Math.min(constants.recordLimit, dbProfile.beacons * dbProfile.epb), dump(req, res))
    test.done()
  })
}

exports.getEntitiesNearLocation = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({userId:testUser._id,latitude:testLatitude,longitude:testLongitude,radius:0.00001})
  req.uri = baseUri + '/__do/getEntitiesNearLocation'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.insertRootEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entity:testEntity, beacon:testBeacon, link:{_to:testBeacon._id}, observation:{latitude:testLatitude, longitude:testLongitude, _beacon:testBeacon._id},userId:testUser._id})
  req.uri = baseUri + '/__do/insertEntity'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkInsertRootEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'entities',find:{_id:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertLinkToRootEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testBeacon._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertBeacon = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({ table:'beacons', find:{ _id:testBeacon._id }})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.deleteBeacon = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/beacons/__ids:' + testBeacon._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.checkInsertObservationForRootEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.insertComment = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,comment:testComment})
  req.uri = baseUri + '/__do/insertComment'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertComment = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}})
  req.uri = baseUri + '/__do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].comments.length === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].commentsCount === 1, dump(req, res))
    test.done()
  })
}

exports.deleteEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,deleteChildren:false})
  req.uri = baseUri + '/__do/deleteEntity'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkDeleteEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'entities',find:{_id:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteLink = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testBeacon._id,_from:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteObservation = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}
