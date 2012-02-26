
/*
 * Test /__do/find
 */

var
  req = require('request'),
  _ = require('underscore'),
  log = require('../../lib/util').log,
  parse = require('../util').parseRes,
  _baseUri = require('../util').getBaseUri() + '/__do',
  _body = {
    table: 'users',
  }
  _options = {
    uri: _baseUri + '/find',
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(_body)
  }

exports.echo = function(test) {
  var options = _.clone(_options)
  options.uri = _baseUri + '/echo'
  req.post(options, function(err, res) {
    parse(res)
    test.ok(_.isEqual(res.body, _body))
    test.done()
  })
}

exports.simpleFind = function(test) {
  var options = _.clone(_options)
  req.post(options, function(err, res) {
    parse(res)
    test.ok(res.body && res.body.data && res.body.data instanceof Array)
    test.done()
  })
}
