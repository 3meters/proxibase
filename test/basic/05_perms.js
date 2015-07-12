/**
 *  Proxibase permission test
 */

var util = require('proxutils')
var log = util.log
var testUtil = require('../util')
var t = testUtil.treq
var skip = testUtil.skip
var adminCred
var user1Cred
var user2Cred
var user1 = {
  name: 'Perm Test User 1',
  type: 'user',
  email: 'permtest1@3meters.com',
  password: 'foobar',
  photo: {
    prefix: 'user1.png',
    source: "aircandi.images",
  },
}
var user2 = {
  name: 'Perm Test User 2',
  type: 'user',
  email: 'permtest2@3meters.com',
  password: 'foobar',
  photo: {
    prefix: 'user2.png',
    source:"aircandi.images",
  },
}
var doc1 = {
  name: 'Doc1',
  data: { foo: 'bar' }
}
var _exports = {}                    // for commenting out tests


exports.signInAsAdmin = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: 'admin', password: 'admin', installId: '1'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    adminCred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.addUser1 = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {data: user1, secret: 'larissa', installId: '1'},
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user && body.user._id)
    user1._id = body.user._id
    test.done()
  })
}


exports.addUser2 = function(test) {
  t.post({
    uri: '/user/create?' + adminCred,
    body: {data: user2, secret: 'larissa', installId: '1'}
  }, function(err, res, body) {
    t.assert(body.session)
    t.assert(body.user && body.user._id)
    user2._id = body.user._id
    test.done()
  })
}


exports.signinUser1 = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: user1.email, password: user1.password, installId: '1'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    user1Cred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.signinUser2 = function(test) {
  t.post({
    uri: '/auth/signin',
    body: {email: user2.email, password: user2.password, installId: '1'}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.session)
    // These credentials will be useds in subsequent tests
    user2Cred = 'user=' + body.user._id + '&session=' + body.session.key
    test.done()
  })
}


exports.user1CanUpdateOwnRecord = function (test) {
  t.post({
    uri: '/data/users/' + user1._id + '?' + user1Cred,
    body: {data: {area: 'Orlando'}}
  }, function(err, res, body) {
    t.assert(body.user)
    t.assert(body.data.area === 'Orlando')
    test.done()
  })
}


exports.user1CannotUpdateUser2sRecord = function(test) {
  t.post({
    uri: '/data/users/' + user2._id + '?' + user1Cred,
    body: {data: {area: 'Denver'}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.cannotAddRecordsWhenNotSignedIn = function(test) {
  t.post({
    uri: '/data/documents',
    body: {data: doc1}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.user1CanCreateARecord = function(test) {
  t.post({
    uri: '/data/documents' + '?' + user1Cred,
    body: {data: doc1}
  }, 201, function(err, res, body) {
    t.assert(body.data._id)
    doc1._id = body.data._id
    test.done()
  })
}


exports.user1OwnsRecordsHeCreates = function(test) {
  t.get('/data/documents/' + doc1._id + '?' + user1Cred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data._owner = user1._id)
    test.done()
  })
}


exports.user2CannotUpdateUser1sRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {name: 'I updated your doc sucka'}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.user2CannotDeleteUser1sRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + user2Cred}, 401,
  function(err, res) {
    test.done()
  })
}


exports.user1CanUpdateRecordsHeCreated = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user1Cred,
    body: {data: {name: 'I updated my own document'}}
  }, function(err, res, body) {
    test.done()
  })
}


exports.user1CanDeleteHisOwnRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + user1Cred},
  function(err, res, body) {
    t.assert(body.count && body.count === 1)
    test.done()
  })
}


exports.user2CanCreateARecord = function(test) {
  delete doc1._id
  t.post({
    uri: '/data/documents' + '?' + user2Cred,
    body: {data: doc1}
  }, 201, function(err, res, body) {
    t.assert(body.data._id)
    doc1._id = body.data._id
    test.done()
  })
}


exports.user2CannotChangeOwnerOfHerOwnRecord = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + user2Cred,
    body: {data: {_owner: util.adminUser._id}}
  }, 401, function(err, res, body) {
    test.done()
  })
}


exports.adminCanUpdateOthersRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {name: 'I can update any document I please'}}
  }, function(err, res, body) {
    test.done()
  })
}

exports.adminCanChangeOwnerOfOthersRecords = function(test) {
  t.post({
    uri: '/data/documents/' + doc1._id + '?' + adminCred,
    body: {data: {_owner: util.adminUser._id}}
  }, function(err, res, body) {
    test.done()
  })
}

exports.adminCanDeleteOthersRecords = function(test) {
  t.del({uri: '/data/documents/' + doc1._id + '?' + adminCred},
  function(err, res, body) {
    t.assert(body.count && body.count === 1)
    test.done()
  })
}


exports.userCannotReadSysCollections = function(test) {
  t.get('/data/patches?' + user1Cred, 200, function(err, res) {
    t.get('/data/actions?' + user1Cred, 401, function(err, res) {
        t.get('/data/installs?' + user1Cred, 401, function(err, res) {
        t.get('/data/sessions?' + user1Cred, 401, function(err, res) {
          test.done()
        })
      })
    })
  })
}


exports.ownerAccessCollectionsWork = function(test) {
  t.post({
    uri: '/data/documents?' + user1Cred,
    body: {data: {_id: 'do.user1DocOwnerAccessTest'}}
  }, 201, function(err, res, body) {
    t.assert('do.user1DocOwnerAccessTest' === body.data._id)
    t.post({
      uri: '/data/documents?' + user2Cred,
      body: {data: {_id: 'do.user2DocOwnerAccessTest'}}
    }, 201, function(err, res, body) {
      t.assert('do.user2DocOwnerAccessTest' === body.data._id)
      t.get('/data/documents?' + user1Cred,
      function(err, res, body) {
        // Check data and meta data on safeFind
        t.assert(body.data && body.data.length === 1)
        t.assert(tipe.isArray(body.sort))
        t.assert(body.count === 1)
        t.assert(!body.more) // More is now optional, set by caller
        t.assert(body.skip === 0)
        t.assert(tipe.isNumber(body.limit))
        t.assert(body.limit > 0)
        t.assert(tipe.isUndefined(body.canEdit))
        body.data.forEach(function(doc) {
          t.assert(doc._id && doc._owner)
          t.assert(user1._id === doc._owner)
          t.assert('do.user2DocOwnerAccessTest' !== doc._id)  // can't see user 2's document

          // Check safeFind for anon user
          t.get('/data/documents',
          function(err, res, body) {
            t.assert(body.data)
            t.assert(body.data.length === 0)
            t.assert(body.count === 0)

            // Check safeFindOne for anon user
            t.get('/data/documents/do.user1DocOwnerAccessTest',
            function(err, res, body) {
              t.assert(body.data === null)
              t.assert(body.count === 0)

              // Check safeFindOne for signed-in user own document
              t.get('/data/documents/do.user1DocOwnerAccessTest?' + user1Cred,
              function(err, res, body) {
                t.assert(body.data)
                t.assert(body.data._id)
                t.assert(body.count === 1)
                t.assert(body.canEdit === true)
                t.assert(tipe.isUndefined(body.sort))
                t.assert(tipe.isUndefined(body.skip))
                t.assert(tipe.isUndefined(body.limit))
                test.done()
              })
            })
          })
        })
      })
    })
  })
}


exports.metaDataWorksforNonOwnerAccessCollections = function(test) {
  t.get('/find/sessions?' + adminCred,
  function(err, res, body) {
    t.assert(body.data)
    t.assert(body.data.length)
    t.assert(body.count >= 1)

    // admin sees canEdit flag a session document
    t.get('/find/sessions/' + body.data[0]._id + '?' + adminCred,
    function(err, res, body) {
      t.assert(body.data)
      t.assert(body.data._id)
      t.assert(body.count === 1)
      t.assert(body.canEdit === true)

      // users see the canEdit flag on their own records
      t.get('/find/users/' + user1._id + '?' + user1Cred,
      function(err, res, body) {
        t.assert(body.data)
        t.assert(body.data._id)
        t.assert(body.data.email)  // private field
        t.assert(body.count === 1)
        t.assert(body.canEdit === true)
        test.done()
      })
    })
  })
}

exports.userPublicFields = function(test) {
  t.get({
    uri: '/find/users?limit=5&' + user1Cred
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var users = body.data
    t.assert(users.length === 5)
    var whiteFields = {
      _id: 0, _owner: 0 ,_creator: 0 ,_modifier: 0 ,name: 0 ,photo: 0 ,
      createdDate: 0 ,photo: 0 ,activityDate: 0 ,modifiedDate: 0 ,schema: 0
    }
    var blackFields = {email: 0, role: 0, phone: 0, collection: 0}
    users.forEach(function(user) {
      t.assert(user._id)
      t.assert(util.adminId !== user._id)
      t.assert(util.anonId !== user._id)
      for (var key in whiteFields) {
        if (user[key]) whiteFields[key]++
      }
      for (var key in blackFields) {
        if (user[key]) blackFields[key]++
      }
    })
    for (var key in whiteFields) {
      t.assert(whiteFields[key], key)
    }
    for (var key in blackFields) {
      t.assert(!blackFields[key], key)
    }
    test.done()
  })
}


exports.userPublicFieldsSeeOwnRecord = function(test) {
  t.get({
    uri: '/data/users/' + user1._id + '?' + user1Cred
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var user = body.data
    t.assert(user._id)
    t.assert(user.name)
    t.assert(user.photo)
    t.assert(user.email)
    t.assert(user.role)  // own role visible to user
    test.done()
  })
}

exports.userPrivateFieldsCannotBeReadByOtherUser = function(test) {
  t.get({
    uri: '/data/users/' + user1._id + '?' + user2Cred
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var user = body.data
    t.assert(user._id)
    t.assert(user.name)
    t.assert(user.photo)
    t.assert(!user.email)
    t.assert(!user.role)  // own role visible to user
    test.done()
  })
}

exports.adminSeesUserPrivateFields = function(test) {
  t.get({
    uri: '/data/users/' + user1._id + '?' + adminCred
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var user = body.data
    t.assert(user._id)
    t.assert(user.name)
    t.assert(user.photo)
    t.assert(user.email)
    t.assert(user.role)
    test.done()
  })
}

exports.userPublicFieldsProjection= function(test) {
  t.post({
    uri: '/find/users/' + user2._id + '?' + user1Cred,
    body: {
      fields: 'name,email,role',
    }
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var user = body.data
    t.assert(user.name)
    t.assert(user._id)    // included by default even though not in field list
    t.assert(!user.email) // private
    t.assert(!user.role)  // own role is visible to user
    t.assert(!user.photo) // public field not included in the field list
    test.done()
  })
}

exports.userPublicFieldsProjectionOwnRecord = function(test) {
  t.post({
    uri: '/find/users/' + user1._id + '?' + user1Cred,
    body: {
      fields: 'name,email,role',
    }
  }, 200, function(err, res, body) {
    t.assert(body && body.data)
    var user = body.data
    t.assert(user.name)
    t.assert(user._id)    // included by default even though not in field list
    t.assert(user.email)  // own email is visible to user
    t.assert(user.role)  // own role is visible to user
    t.assert(!user.photo) // public field not included in the field list
    test.done()
  })
}

