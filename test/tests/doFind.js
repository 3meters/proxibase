
/*
 * Test /__do/find
 */

var
  req = require('request'),
  _ = require('underscore'),
  log = require('../../lib/util').log,
  check = require('../util').check,
  getOptions = require('../util').getOptions,
  path = '/__do/find'

exports.echo = function(test) {
  var body = { table: 'users' }
  var options = getOptions('__do/echo', body)
  req.post(options, function(err, res) {
    check(res, test)
    test.ok(_.isEqual(res.body, body))
    test.done()
  })
}

exports.simpleFind = function(test) {
  var body = { table: 'users' }
  var options = getOptions(path, body)
  req.post(options, function(err, res) {
    check(res, test)
    test.ok(res.body && res.body.data && res.body.data instanceof Array)
    test.done()
  })
}
