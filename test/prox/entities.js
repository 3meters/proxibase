var 
  req = require('request'),
  _ = require('underscore'),
  log = require('../../lib/log'),
  load = require('../util').loadProx,
  parse = require('../util').parseRes,
  _baseUri = require('../util').getBaseUri,
  _uri = _baseUri + "/entities",
  _body = {
    data: {
      _id: "tid001",
      name: "Test Entity",
      type: "picture"
    }
  },
  _options = {
    uri: _uri,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(_body)
  }

exports.getEntities = function (test) {
  req.get(_uri, function(err, res) {
    parse(res)
    test.done()
  })
}

// delete first in case old test left data around
exports.delUsers = function delUsers2(test) {
  req.del(_uri + '/__ids:tid', function(err, res) {
    parse(res)
    test.done()
  })
}

exports.addUser = function(test) {
  var options = _.clone(_options)
  req.post(options, function(err, res) {
    parse(res)
    test.ok(res.body.count === 1)
    test.ok(res.body.data[0]._id && res.body.data[0]._id === _body.data._id)
    test.done()
  })
}

exports.checkUser = function(test) {
  req.get(_uri + "/__ids:tid", function(err, res) {
    parse(res)
    test.ok(res.body.data[0].name && res.body.data[0].name === _body.data.name)
    test.done()
  })
}

exports.updateUser = function(test) {
  var options = _.clone(_options)
  var body = _.clone(_body)
  body.data.name = 'Test User2'
  options.body= JSON.stringify(body)
  options.uri = _uri + '/__ids:' + _body.data._id
  req.post(options, function(err, res) {
    parse(res)
    test.ok(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUser = function(test) {
  req.get(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    test.ok(res.body.data[0].name === 'Test User2')
    test.done()
  })
}

exports.deleteUpdateUser = function(test) {
  req.del(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    test.ok(res.body.count === 1)
    test.done()
  })
}

exports.checkUpdatedUserDeleted = function(test) {
  req.get(_uri + '/__ids:' + _body.data._id, function(err, res) {
    parse(res)
    test.ok(res.body.count === 0)
    test.done()
  })
}
