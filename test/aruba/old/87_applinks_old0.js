/**
 *  Proxibase applinks tests
 *
 */

var util = require('proxutils')
var async = require('async')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var admin
var userCred
var adminCred
var _exports = {}

var testEntity = {
  schema : util.statics.schemaPlace,
  name : "Test Place Entity Suggest Applinks",
  photo: {
    prefix: "https://s3.amazonaws.com/3meters_images/1001_20111224_104245.jpg",
    source: "aircandi",
  },
  signalFence : -100,
  enabled : true,
  locked : false,
}

var ballRoomLoc = {
  lat: 47.652084,
  lng: -122.353025,
}

// Some persisted Ids. Factuals change periodically.
// Seattle Ballroom
var ballRoomId = ''
var ballRoom4sId = '4abebc45f964a520a18f20e3'
var ballRoomFacId = '46aef19f-2990-43d5-a9e3-11b78060150c'
var ballRoomYelpId = 'the-ballroom-seattle'
var ballRoomGoogleId = 'f0147a535bedf4bb948f35379873cab0747ba9e2|aGoogleRef'


exports.insertPlaceEntitySuggestApplinksFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    insertApplinks: true,
    entity: util.clone(testEntity),
  }
  body.entity.provider = {foursquare: ballRoom4sId}  // Seattle Ballroom
  t.post({uri: '/do/insertEntity?' + adminCred, body: body}, 201,
    function(err, res) {
      t.assert(res.body.data && res.body.data.linksIn)
      var links = res.body.data.linksIn
      t.assert(links.length > 3)
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'foursquare'
            && link.shortcut.appId === ballRoom4sId
          )
      }))
      t.assert(links.some(function(link) {   // Invisible due to alcohal (changed 5/21/14)
        return (link.shortcut.app === 'facebook')
      }))
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'website')
      }))
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'twitter')
      }))
      t.assert(links.some(function(link) {
        return (link.shortcut.app === 'yelp')
      }))
      links.forEach(function(link) {
        t.assert(link.shortcut.app !== 'factual')
      })
      test.done()
    }
  )
}

