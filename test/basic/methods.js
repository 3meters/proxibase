
/*
 *  Proxibase custom methods test
 */

var
  assert = require('assert'),
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
  testLink = {
    _id : '0001.111111.11111.111.222222',
    _to : '0003:11:11:11:11:11:22',
    _from : '0002.111111.11111.111.111111',
    toTableId: 3,
    fromTableId: 2
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
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

/* housekeeping */
exports.cleanupUser = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/users/ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

/* housekeeping */
exports.cleanupEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,deleteChildren:false})
  req.uri = baseUri + '/do/deleteEntity'
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

/* housekeeping */
exports.cleanupBeacon = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/beacons/ids:' + testBeacon._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

/* housekeeping */
exports.cleanupLink = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/links/ids:' + testLink._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.insertUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({data:testUser})
  req.uri = baseUri + '/data/users'
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
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.updateUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({data:{location:'Testburg, WA'}})
  req.uri = baseUri + '/data/users/ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data.location && res.body.data.location === 'Testburg, WA', dump(req, res))    
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/data/users/ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].location === 'Testburg, WA', dump(req, res))
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/users/ids:' + testUser._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.getEntitiesLoadChildren = function (test) {
  /*
   * We don't currently populate the smoke test data with any entities that have
   * both a parent and children.
   */
  req.method = 'post'
  req.body = JSON.stringify({ entityIds:[constants.entityId], eagerLoad:{parents:false,children:true,comments:true} })
  req.uri = baseUri + '/do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0], dump(req, res))
    var record = res.body.data[0]
    assert(record.children.length === dbProfile.spe, dump(req, res))
    assert(record.childCount === dbProfile.spe, dump(req, res))
    assert(!record.parents, dump(req, res))
    assert(record.parentCount === 0, dump(req, res))
    assert(record.comments.length === dbProfile.cpe, dump(req, res))
    assert(record.commentCount === dbProfile.cpe, dump(req, res))
    assert(record._beacon === constants.beaconId, dump(req, res))
    assert(record.location, dump(req, res))
    assert(record.location.latitude, dump(req, res))
    assert(record.location.longitude, dump(req, res))
    test.done()
  })
}

exports.getEntitiesLoadParents = function (test) {
  /*
   * - We don't currently populate the smoke test data with any entities that have both a parent and children. 
   * - We also don't have any entities with multiple parents.
   */
  req.method = 'post'
  req.body = JSON.stringify({ entityIds:[constants.childEntityId], eagerLoad:{parents:true,children:false,comments:true} })
  req.uri = baseUri + '/do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0], dump(req, res))
    var record = res.body.data[0]
    assert(!record.children, dump(req, res))
    assert(record.childCount === 0, dump(req, res))
    assert(record.parents.length === 1, dump(req, res))
    assert(record.parentCount === 1, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeacons = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({beaconIdsNew:[constants.beaconId],eagerLoad:{children:true,comments:false}})
  req.uri = baseUri + '/do/getEntitiesForBeacons'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === dbProfile.epb, dump(req, res))
    assert(res.body.date, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForBeaconsLimited = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({ 
    beaconIdsNew:[constants.beaconId], 
    eagerLoad:{ children:true,comments:false }, 
    options:{limit:3, skip:0, sort:{modifiedDate:-1}}
  })
  req.uri = baseUri + '/do/getEntitiesForBeacons'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 3, dump(req, res))
    assert(res.body.more === false, dump(req, res))
    test.done()
  })
}

exports.getEntitiesForUser = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({userId:constants.uid1, eagerLoad:{children:false,comments:false}})
  req.uri = baseUri + '/do/getEntitiesForUser'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === Math.min(constants.recordLimit,
        dbProfile.beacons * dbProfile.epb / dbProfile.users), dump(req, res))
    test.done()
  })
}

exports.getEntitiesNearLocation = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({userId:testUser._id,latitude:testLatitude,longitude:testLongitude,radius:0.00001})
  req.uri = baseUri + '/do/getEntitiesNearLocation'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.insertRootEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entity:testEntity, beacon:testBeacon, link:{_to:testBeacon._id}, observation:{latitude:testLatitude, longitude:testLongitude, _beacon:testBeacon._id},userId:testUser._id})
  req.uri = baseUri + '/do/insertEntity'
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
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertLinkToRootEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testBeacon._id}})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertBeacon = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({ table:'beacons', find:{ _id:testBeacon._id }})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.deleteBeacon = function (test) {
  req.method = 'delete'
  req.uri = baseUri + '/data/beacons/ids:' + testBeacon._id
  request(req, function(err, res) {
    check(req, res)
    test.done()
  })
}

exports.checkInsertObservationForRootEntity = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.insertComment = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,comment:testComment})
  req.uri = baseUri + '/do/insertComment'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}

exports.checkInsertComment = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityIds:[testEntity._id],eagerLoad:{children:true,comments:true}})
  req.uri = baseUri + '/do/getEntities'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].comments.length === 1, dump(req, res))
    assert(res.body.data && res.body.data[0] && res.body.data[0].commentCount === 1, dump(req, res))
    test.done()
  })
}

exports.updateEntity = function (test) {
  req.method = 'post'
  testEntity.title = 'Testing super candi'
  req.body = JSON.stringify({entity:testEntity})
  req.uri = baseUri + '/do/updateEntity'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkUpdateEntity = function (test) {
  req.method = 'get'
  req.uri = baseUri + '/data/entities/ids:' + testEntity._id
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data && res.body.data[0] && res.body.data[0].title === 'Testing super candi', dump(req, res))
    test.done()
  })
}

exports.insertLink = function (test) {
  /*
   * Jayma: This doesn't fail but I can't find the inserted link document and 
   * the subsequent updateLink call fails because it can't find it.
   */
  req.method = 'post'
  req.body = JSON.stringify({data:testLink})
  req.uri = baseUri + '/data/links'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id && res.body.data._id === testLink._id, dump(req, res))
    test.done()
  })
}

/*
exports.updateLink = function (test) {
  updateLink = {
    _to : '0002.111111.11111.111.111112',
    _from : '0002.111111.11111.111.111111'
  }

  req.method = 'post'
  req.body = JSON.stringify({link:updateLink, originalToId:'0002.111111.11111.111.111111'})
  req.uri = baseUri + '/do/updateLink'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    assert(res.body.data && res.body.data._id, dump(req, res))
    test.done()
  })
}

exports.checkUpdateLink = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testLink._to, _from:testLink._from}})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 1, dump(req, res))
    test.done()
  })
}
*/

exports.deleteEntity = function (test) {
  req.method = 'post'
  req.body = JSON.stringify({entityId:testEntity._id,deleteChildren:false})
  req.uri = baseUri + '/do/deleteEntity'
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
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteLink = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'links',find:{_to:testBeacon._id,_from:testEntity._id}})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}

exports.checkDeleteObservation = function(test) {
  req.method = 'post'
  req.body = JSON.stringify({table:'observations',find:{_beacon:testBeacon._id,_entity:testEntity._id}})
  req.uri = baseUri + '/do/find'
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.count === 0, dump(req, res))
    test.done()
  })
}
