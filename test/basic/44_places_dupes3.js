/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var db = testUtil.db
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests



// Get user and admin sessions and store the credentials in module globals
exports.getSessions = function(test) {
  testUtil.getUserSession(function(session) {
    user = {_id: session._owner}
    userCred = 'user=' + session._owner + '&session=' + session.key
    testUtil.getAdminSession(function(session) {
      adminCred = 'user=' + session._owner + '&session=' + session.key
      test.done()
    })
  })
}


exports.dupeZokaMergesOnPhoneNumber = function(test) {

  if (disconnected) return skip(test)

  var zokaLoc = {
    lat: 47.668781,
    lng: -122.332883,
  }

  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: {
        name: 'Zoka1',
        schema: 'place',
        provider: {
          foursquare: '41b3a100f964a520681e1fe3',
        },
        location: zokaLoc,
        address: 'foursquareAddress',
        phone: '2065454277',
      },
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    var zoka1 = body.data
    t.post({
      uri: '/do/insertEntity?' + adminCred,
      body: {
        entity: {
          name: 'Zoka2',
          schema: 'place',
          provider: {
            yelp: 'zoka-coffee-roaster-and-tea-company-seattle-2'
          },
          location: zokaLoc,
          address: 'yelpAddress',
          phone: '2065454277',
        },
      }
    }, 201, function(err, res, body) {
      t.assert(body.data)
      var zoka2 = body.data
      t.assert(zoka1._id === zoka2._id, {zoka1: zoka1, zoka2: zoka2}) // proves merged on phone number
      t.assert(zoka2.provider.foursquare === '41b3a100f964a520681e1fe3' )
      t.assert(zoka2.provider.yelp === 'zoka-coffee-roaster-and-tea-company-seattle-2')
      t.assert('Zoka2' === zoka2.name) // name last writer wins foursquare
      t.assert('yelpAddress' === zoka2.address) // address last writer wins
      t.get('/places/near?location[lat]=47.668781&location[lng]=-122.332883&refresh=1',
      function (err, res, body) {
        t.assert(body.data.length)
        var zokas = body.data.filter(function(place) {
          return place.name.match(/Zoka/i)
        })
        t.assert(zokas.length === 1, zokas)
        var nearZoka = zokas[0]
        t.assert(nearZoka.provider.foursquare, nearZoka)
        t.assert(nearZoka.provider.yelp, nearZoka)
        t.assert(nearZoka.provider.google, nearZoka)
        test.done()
      })
    })
  })
}

