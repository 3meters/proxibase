/**
 *  Proxibase duplicate place provider tests
 *
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var fs = require('fs')
var path = require('path')
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
var skip = testUtil.skip
var user
var userCred
var adminCred
var _exports = {} // for commenting out tests

var luckyStrikeLoc = {
  lat: 47.616658,
  lng: -122.201373,
}

var luckyStrikeId = '4a0df0d8f964a520b1751fe3'
var powerPlayId = '4bc0ffe974a9a5934423d1f6'
var luckyStrike = {}
var powerPlay = {}

var luckyStrikeIdFactual = '46ba739c-21f7-4d72-a544-5581c1d7a7a1'
var luckyStrikeFactual = {}

var luckyStrikeSplace = {}


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

exports.dupePlaceMaggiano = function(test) {

  if (disconnected) return skip(test)

  var locMag = {
    lat : 47.617099145207682,
    lng : -122.20097064971924,
  }
  t.post({
    uri: '/data/places?' + userCred,
    body: {
      data: {
        name: "Maggiano's Little Italy",
        location: locMag,
        phone: '4255196476',
        provider: {foursquare: '43976c82f964a520a52b1fe3'},
      },
    }
  }, 201, function(err, res, body) {
    var place = body.data
    t.assert(place && place._id)
    t.post({
      uri: '/places/near',
      body: {
        location: locMag,
        provider: 'google',
        radius: 500,
        includeRaw: false,
        limit: 100,
        timeout: 15000,
      }
    }, function(err, res, body) {
      var cMaggiano = 0
      body.data.forEach(function(place){
        if (0 === place.name.indexOf('Magg')) cMaggiano++
      })
      t.assert(1 === cMaggiano)
      test.done()
    })
  })
}

exports.dupePlacesMergeOnProviderId = function(test) {

  if (disconnected) return skip(test)

  placeId = ''
  t.post({
    uri: '/do/insertEntity?' + userCred,
    body: {
      entity: {
        name: 'Zoka1',
        schema: util.statics.schemaPlace,
        provider: {
          foursquare: '41b3a100f964a520681e1fe3',
        },
        phone: '2065454277',
      },
    }
  }, 201, function(err, res, body) {
    t.assert(body.data)
    placeId = body.data._id
    t.post({
      uri: '/do/insertEntity?' + userCred,
      body: {
        entity: {
          name: 'Zoka2',
          schema: util.statics.schemaPlace,
          provider: {
            factual: 'fdc45418-be3b-4ab9-92d6-62ae6fb6ce48',
          },
          phone: '2065454277',
        },
      }
    }, 403, function(err, res, body) {
      t.assert(body.data)
      var place = body.data
      t.assert(placeId === place._id) // proves merged on phone number
      t.assert('Zoka1' === place.name)
      t.assert(place.provider.foursquare)
      t.post({
        uri: '/do/insertEntity?' + userCred,
        body: {
          entity: {
            name: 'Zoka3',
            schema: util.statics.schemaPlace,
            provider: {
              factual: 'fdc45418-be3b-4ab9-92d6-62ae6fb6ce48',
            },
          },
        }
      }, 403, function(err, res, body) {
        t.assert(body.data)
        var place = body.data
        t.assert(placeId === place._id) // proves merged on provider Id
        t.assert('Zoka1' === place.name)
        t.assert(place.provider.foursquare)
        t.assert(place.provider.factual)
        test.done()
      })
    })
  })
}


exports.getPlacesNearLocation = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeId === place.provider.foursquare) {
        luckyStrike = place
        foundLuckyStrike++
      }
      if (powerPlayId === place.provider.foursquare) {
        powerPlay = place
        foundPowerPlay++
      }
    })
    t.assert(1 === foundLuckyStrike)
    t.assert(1 === foundPowerPlay)
    test.done()
  })
}


exports.getPlacesNearLocationFactual = function(test) {
  if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'factual',
      radius: 500,
      includeRaw: false,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeIdFactual === place.provider.factual) {
        luckyStrikeFactual = place
        foundLuckyStrike++
      }
    })
    t.assert(1 === foundLuckyStrike)
    test.done()
  })
}


exports.insertPlaceEntity = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
    insertApplinks: true,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 201,
    function(err, res, body) {
      t.assert(body && body.data)
      luckyStrikeSplace = body.data
      var links = luckyStrikeSplace.linksIn

      t.post({
        uri: '/do/getEntitiesForEntity',
        body: {
          entityId: luckyStrikeSplace._id,
          cursor: {
            linkTypes: [util.statics.typeContent],
            schemas: [util.statics.schemaApplink],
            direction: 'in',
          },
        }
      }, function(err, res, body) {
        var applinks = body.data
        t.assert(applinks && applinks.length)
        t.assert(links && links.length)
        var applinkMap = {}
        applinks.forEach(function(applink) {
          if (!util.tipe.isNumber(applinkMap[applink.type])) {
            applinkMap[applink.type] = 0
          }
          applinkMap[applink.type]++
          t.assert(links.some(function(link) {
            return (applink._id === link._from)
          }), applink)
        })
        t.assert(applinks.length === links.length)
        t.assert(!applinkMap.twitter || (applinkMap.twitter === 1), applinkMap)
        t.assert(applinkMap.website === 1, applinkMap)
        t.assert(applinkMap.facebook >= 1, applinkMap)
        t.assert(applinkMap.facebook < 5, applinkMap)
        test.done()
      })
    }
  )
}

exports.insertPlaceEntityAgain = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrike,
    insertApplinks: true,
    includeRaw: false,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 403,
    function(err, res, body) {
      t.assert(body && body.data)
      var newPlace = body.data
      t.assert(luckyStrikeSplace._id === newPlace._id)  // proves merge on provider.provider worked
      newPlace.linksIn.forEach(function(link) {
        t.assert(link.shortcut.sortDate > luckyStrikeSplace.modifiedDate)  // proves applinks were updated
      })
      t.assert(luckyStrikeSplace.linksIn.length === newPlace.linksIn.length, luckyStrikeSplace.linksIn)  // proves link records were not duped
      test.done()
    }
  )
}

exports.insertDupePlaceEntityFromFactual = function(test) {
  if (disconnected) return skip(test)
  var body = {
    entity: luckyStrikeFactual,
    insertApplinks: true,
  }
  t.post({uri: '/do/insertEntity?' + userCred, body: body}, 403,
    function(err, res, body) {
      t.assert(body && body.data)
      var splace = body.data
      t.assert(luckyStrikeSplace._id === splace._id)  // proves merge on phone number + !provider match worked
      t.assert(splace.provider)
      t.assert(luckyStrikeId === splace.provider.foursquare)
      t.assert(luckyStrikeIdFactual === splace.provider.factual)  // proves merged provider.provider
      test.done()
    }
  )
}

exports.getPlacesNearLocationWithUpsizedPlace = function(test) {
 if (disconnected) return skip(test)
  t.post({
    uri: '/places/near',
    body: {
      location: luckyStrikeLoc,
      provider: 'foursquare',
      radius: 500,
      includeRaw: false,
      limit: 50,
    }
  }, function(err, res, body) {
    var foundLuckyStrike = 0
    var foundPowerPlay = 0
    var places = body.data
    places.forEach(function(place) {
      t.assert(place.provider)
      if (luckyStrikeId === place.provider.foursquare) {
        foundLuckyStrike++
        t.assert(place.name === luckyStrike.name)
      }
      if (powerPlayId === place.provider.foursquare) {
        foundPowerPlay++
        t.assert(place.name === powerPlay.name)
      }
    })
    t.assert(1 === foundLuckyStrike)
    t.assert(1 === foundPowerPlay)
    test.done()
  })
}


