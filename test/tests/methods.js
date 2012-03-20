/*
/*
 *  Proxibase rest basic test
 */

var
  request = require('request'),
  log = require('../../lib/util').log,
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  baseUri = testUtil.getBaseUri(),
  req = testUtil.getDefaultReq(),
  testUser = {
    _id : "0000.111111.11111.111.111111",
    name : "John Q Test",
    email : "test@3meters.com",
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
  testBeaconId = '0003:11:11:11:11:11:11',
  testLatitude = 50,
  testLongitude = 50,
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

exports.deleteUser = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/users/__ids:' + testUser._id
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
  req.body = JSON.stringify({table:'users',find:{email:'test@3meters.com'}})
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
  req.body = JSON.stringify({entityIds:['0002.111207.07500.000.001404'],eagerLoad:{children:true,comments:true}})
  req.uri = baseUri + '/__do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].children.length === 3, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].childrenCount === 3, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].comments, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].commentsCount === 0, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0]._beacon === '0003:00:1c:b3:ae:bf:f0', dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].location, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].location.latitude, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].location.longitude, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeacons = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({beaconIds:['0003:00:1c:b3:ae:bf:f0'],eagerLoad:{children:true,comments:false}})
  req.uri = baseUri + '/__do/getEntitiesForBeacons'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 12, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({userId:testUser._id,eagerLoad:{children:false,comments:false}})
  req.uri = baseUri + '/__do/getEntitiesForUser'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
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

exports.cleanupEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,deleteChildren:false})
  req.uri = baseUri + '/__do/deleteEntity'
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.insertEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entity:testEntity,link:{_to:testBeaconId},observation:{latitude:testLatitude,longitude:testLongitude,_beacon:testBeaconId},userId:testUser._id})
  req.uri = baseUri + '/__do/insertEntity'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkInsertEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'entities',find:{_id:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertLink = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testBeaconId,_from:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertObservation = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeaconId,_entity:testEntity._id}})
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
  req.body = JSON.stringify({table:'links',find:{_to:testBeaconId,_from:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteObservation = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeaconId,_entity:testEntity._id}})
  req.uri = baseUri + '/__do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}
