/**
 * Experimental: 
 *
 * This is a shim that converts requests expected by mikael's request module
 * into the format expected by TJ's superagent module.
 *
 * It sneaks into the module namespace via a symlink in test/node_modules.
 * if the symlink /test/node_modules/request.js links to this file, 
 * then all files that say var request = require('request') will point here
 * If the symlink does not exist, then those files will point to the version 
 * of request known by npm aka https://github.com/mikeal/request
 */

var superagent = require('superagent')

var request = function(options, cb) {

  var agent

  if (typeof options === 'string') options = {uri: options}
  options.method = options.method || 'get'

  agent = new superagent.Request(options.method, options.uri)

  if (options.body) agent.send(options.body)
  var headers = options.headers
  for (var header in headers) {
    agent.set(header, headers[header])
  }
  if (options.json) agent.type('json')
  agent.end(function(err, res) {
    if (res && !res.body) {
      try { res.body = JSON.parse(res.text) }
      catch (e) { res.body = res.text || {} }
    }
    var body = (res && res.body) ? res.body : undefined
    return cb(err, res, body)
  })
}

request.get = function(options, cb) {
  if (typeof options === 'string') options = {uri: options}
  options.method = 'get'
  request(options, cb)
}

request.post = function(options, cb) {
  options.method = 'post'
  request(options, cb)
}

request.del = function(options, cb) {
  options.method = 'del'
  request(options, cb)
}

module.exports = request
