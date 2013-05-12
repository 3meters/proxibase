/**
 * Call updateEntity refreshSources = true for all place entities
 */

var util = require('proxutils')
var log = util.log
var request =  require('request').defaults({
  json: true,
  strictSSL: false,
})
var cli = require('commander')
var async = require('async')
var cred = ''
var noLimit = true
var count = 0
var results = []
var server = 'https://localhost:6643'

cli
  .option('-s, --server <server>', 'server url [' + server + ']')
  .option('-e, --email <email>', 'user email [admin]', String, 'admin')
  .option('-p, --password <password>', 'password [admin]', String, 'admin')
  .option('-i, --index <index>', 'index of record to start on [0]', Number, 0)
  .option('-n, --number <number>', 'number of records to update', Number, 0)
  .option('-d, --delay <delay>', 'seconds to wait between calls [0]', Number, 0)
  .option('-x, --execute', 'update all sources, otherwise just step through them all')
  .parse(process.argv)

if (cli.server) server = cli.server
if (cli.number) noLimit = false

request.post({
    uri: server + '/auth/signin', 
    body: {user: {email: cli.email, password: cli.password}},
  }, function(err, res, body) {
    if (err) throw err
    if (!(body.user && body.session)) throw new Error('Login failed')
    cred = 'user=' + body.user._id + '&session=' + body.session.key
    updateEnt(cli.index)
  })

function updateEnt(skip) {
  request.post({
    uri: server + '/do/find?' + cred,
    body: {
      collection: 'entities',
      find: {type: 'com.aircandi.candi.place'},
      sort: {_id: 1},
      limit: 1,
      skip: skip,
    }
  }, function (err, res, body) {
    if (err) throw err
    if (res.statusCode === 404) return finish(skip)
    if (!cli.execute) return next()
    var entityId = body.data[0]._id
    request.post({
      uri: server + '/do/updateEntity?' + cred,
      body: {
        entity: {_id: entityId},
        refreshSources: true,
        skipActivityDate: true,
      }
    }, function(err, res, body) {
      if (err) throw err
      if (200 !== res.statusCode) {
        log('Error: updateEntity returned status ' + res.statusCode +
            ' for entity ' + entityId, body)
        throw new Error('Unexpected return status form updateEntity')
      }
      next()
    })

    function next() {
      log(skip)
      if (body.more && (noLimit || count++ < cli.number)) {
        skip++
        setTimeout(function() {
          return updateEnt(skip)
        }, cli.delay * 1000)
      }
      else finish(skip)
    }
  })
}

function finish(count) {
  log('Updated ' + count + ' entities')
}
