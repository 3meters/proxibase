/*
 * Load dummy data into prox and school
 */

var
  req = require('request'),
  _ = require('underscore'),
  log = require('../../lib/log'),
  parse = require('./util').parseRes,
  _baseUri = require('../util')._baseUri,
  _body = {
    data: {
      _id: "tid",
      name: "Test User",
      email: "foo@bar.com"
    }
  },
  _options = {
    uri: _uri,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(_body)
  }


exports.prox = function() {

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

}
