/*
 * hammer.js:  paralel load tests for proxibase service
 */


var
  util = require('../lib/util'),
  timer = new util.Timer(),
  fs = require('fs'),
  assert = require('assert'),
  cli = require('commander'),
  async = require('async'),
  reporter = require('nodeunit').reporters.default,
  req = require('request'),
  testUtil = require('./util'),
  testDir = 'tests',
  cwd = process.cwd(),
  configFile = 'configtest.js',
  config = util.findConfig(configFile),
  serverUrl = util.getUrl(config),
  log = util.log

assert ($1, "Usage: node hammer serverUrl")


