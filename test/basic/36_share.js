/**
 *  Share tests
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var dbProfile = testUtil.dbProfile
var skip = testUtil.skip
var t = testUtil.treq  // newfangled test helper
var disconnected = testUtil.disconnected
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

var tarzanCred, janeCred, cheetahCred

exports.addSomeTestData = function(test) {

  t.post({
    uri: '/user/create',
    body: { data: {
      _id: 'us.shareTestTarzan',
      name: 'Tarzan',
      email: 'shareTestTarzan@3meters.com',
      password: 'elephant',
    }, secret: 'larissa', installId: '123'}
  }, function(err, res, body) {
    t.assert(body.user && body.session)
    tarzanCred = 'user=' + body.session._owner + '&session=' + body.session.key
    t.post({
      uri: '/user/create',
      body: { data: {
        _id: 'us.shareTestJane',
        name: 'Jane',
        email: 'shareTestJane@3meters.com',
        password: 'elephant',
      }, secret: 'larissa', installId: '123'}
    }, function(err, res, body) {
      t.assert(body.user && body.session)
      janeCred = 'user=' + body.session._owner + '&session=' + body.session.key
      t.post({
        uri: '/user/create',
        body: { data: {
          _id: 'us.shareTestCheetah',
          name: 'Cheetah',
          email: 'shareTestCheetah@3meters.com',
          password: 'elephant',
        }, secret: 'larissa', installId: '123'}
      }, function(err, res, body) {
        t.assert(body.user && body.session)
        cheetahCred = 'user=' + body.session._owner + '&session=' + body.session.key
        t.post({
          uri: '/data/places?' + tarzanCred,
          body: {data: {_id: 'pl.treehouse', name: 'Treehouse'}}
        }, 201, function(err, res, body) {
          t.post({
            uri: '/data/messages?' + tarzanCred,
            body: {data: {_id: 'me.howdyFromTarzan', description: 'Tarzan likes Jane!'}}
          }, 201, function(err, res, body) {
            t.post({
              uri: '/data/links?' + tarzanCred,
              body: {data: {
                  _from: 'me.howdyFromTarzan',
                  _to: 'pl.treehouse',
                  type: 'content',
              }}
            }, 201, function(err, res, body) {
              test.done()
            })
          })
        })
      })
    })
  })
}

exports.ignoreUser = function(test) {
  t.post({
    uri: '/data/ignores?' + janeCred,
    body: {data: {_id: 'ig.janeIgnoresTarzan', _ignore: 'us.shareTestTarzan'}},
  }, 201, function(err, res, body) {
    t.get('/data/ignores?query[_ignore]=us.shareTestTarzan&' + tarzanCred,
    function(err, res, body) {
      t.assert(body.data.length === 0)
      test.done()
    })
  })
}

exports.sharePlace = function(test) {
  t.post({
    uri: '/shares?' + tarzanCred,
    body: {
      _share: 'pl.treehouse',
      _tos: [
        'us.shareTestJane',
        'us.shareTestCheetah',
      ],
      description: 'Would you like to see my Treehouse?',
    }
  }, function(err, res, body) {
    t.assert(body.data.length === 2)
    t.get('/shares/from/me?' + tarzanCred,
    function(err, res, body) {
      t.assert(body.data.length === 2)
      body.data.forEach(function(share) {
        t.assert(share._to === 'us.shareTestJane' || share._to === 'us.shareTestCheetah')
        t.assert(share.shareSchema === 'place')
        t.assert(share._share === 'pl.treehouse')
      })
      test.done()
    })
  })
}

exports.shareMessage = function(test) {
  t.post({
    uri: '/shares?' + tarzanCred,
    body: {
      _share: 'me.howdyFromTarzan',
      _tos: [
        'us.shareTestJane',
        'us.shareTestCheetah',
      ],
      description: 'Would you like to see my Howdy Message?',
    }
  }, function(err, res, body) {
    t.assert(body.data.length === 2)
    t.get('/shares/from/me?query[shareSchema]=message&' + tarzanCred,  // works just like rest api
    function(err, res, body) {
      t.assert(body.data.length === 2)
      body.data.forEach(function(share) {
        t.assert(share._to === 'us.shareTestJane' || share._to === 'us.shareTestCheetah')
        t.assert(share.shareSchema === 'message')
        t.assert(share._share === 'me.howdyFromTarzan')
      })
      test.done()
    })
  })
}

exports.canSeeSharesToMeViaRest = function(test) {
  t.get('/find/shares?query[_to]=us.shareTestCheetah&' + cheetahCred,
  function(err, res, body) {
    t.assert(body.data.length === 2)
    test.done()
  })
}


exports.canSeeSharesToMeViaAPI = function(test) {
  t.get('/shares/to/me?' + cheetahCred,
  function(err, res, body) {
    t.assert(body.data.length === 2)
    test.done()
  })
}

exports.cannotSeeSharesToOthers = function(test) {
  t.get('/find/shares?query[_to]=us.shareTestJane&' + cheetahCred,
  function(err, res, body) {
    t.assert(body.data.length === 0)
    test.done()
  })
}

exports.sharesToMeFiltersOurSharesFromUsersIHaveIgnored = function(test) {

  t.get('/shares/from/me?query[_to]=us.shareTestJane&' + tarzanCred,
  function(err, res, body) {
    t.assert(body.data.length === 2)  // tarzan sees his two invites to jane
    t.get('/shares/to/me?' + janeCred,
    function(err, res, body) {
      t.assert(body.data.length === 0)  // jane doesn't see the invites because she is ignoring tarzan
      t.delete({
        uri: '/data/ignores/ig.janeIgnoresTarzan?' + janeCred,  // jane relents
      }, function(err, res, body) {
        t.assert(body.count === 1)
        t.get('/shares/to/me?' + janeCred,
        function(err, res, body) {
          t.assert(body.data.length === 2)  // now she sees tarzan's invites
          test.done()
        })
      })
    })
  })
}


exports.sharedLinksWereCreated = function(test) {
  t.get('/data/links?query[_owner]=us.shareTestTarzan&query[toSchema]=share&' + tarzanCred,
  function(err, res, body) {
    t.assert(body.data.length === 4)
    body.data.forEach(function(link) {
      t.assert(link.toSchema === 'share')
      t.assert(link.fromSchema === 'user')
      t.assert(link.type === 'create')
    })
    t.get('/data/links?query[_owner]=us.shareTestCheetah&query[toSchema]=user&' + cheetahCred,
    function(err, res, body) {
      t.assert(body.data.length === 2)
      body.data.forEach(function(link) {
        t.assert(link.toSchema === 'user')
        t.assert(link.fromSchema === 'share')
        t.assert(link.type === 'content')
      })
      test.done()
    })
  })
}

exports.actionsWereCreated = function(test) {
  t.get('/data/actions?query[_user]=us.shareTestTarzan&' + adminCred,
  function(err, res, body) {
    t.assert(body.data.length === 4)
    body.data.forEach(function(action) {
      t.assert(action._entity)
      var schemaName = util.parseId(action._entity).schemaName
      t.assert(action.event === 'insert_entity_share')
    })
    test.done()
  })
}
