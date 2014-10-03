/**
 * Update entity.place.provider type string and provider id type string
 * to map { provider: id }
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
var read = 0
var updated = 0
var results = []
var server = 'https://localhost:6643'

cli
  .option('-s, --server <server>', 'server url [' + server + ']')
  .option('-e, --email <email>', 'user email [admin]', String, 'admin')
  .option('-p, --password <password>', 'password [admin]', String, 'admin')
  .option('-i, --index <index>', 'index of record to start on [0]', Number, 0)
  .option('-n, --number <number>', 'number of records to update', Number, 0)
  .option('-d, --delay <delay>', 'seconds to wait between calls [0]', Number, 0)
  .option('-x, --execute', 'perfrom the update, otherwise just step through them all')
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
    read++
    var ent = body.data[0]
    if (!(ent.place
        && util.type.isString(ent.place.provider)
        && util.type.isString(ent.place.id)
        )) {
      return next()
    }

    // Convert the place object to its new format
    var newPlace = util.clone(ent.place)
    var providerKey = ent.place.provider
    newPlace.provider = {}
    newPlace.provider[providerKey] = ent.place.id
    delete newPlace.id
    delete newPlace.providers

    if (!cli.execute) return next()

    // Update it
    request.post({
      uri: server + '/do/updateEntity?' + cred,
      body: {
        entity: {
          _id: ent._id,
          place: newPlace,
        },
        skipActivityDate: true,
      }
    }, function(err, res, body) {
      if (err) throw err
      if (200 !== res.statusCode) {
        log('Error: updateEntity returned status ' + res.statusCode +
            ' for entity ' + ent._id, body)
        throw new Error('Unexpected return status form updateEntity')
      }
      updated++
      next()
    })

    function next() {
      log(skip)
      if (body.more && (noLimit || read++ < cli.number)) {
        skip++
        setTimeout(function() {
          return updateEnt(skip)
        }, cli.delay * 1000)
      }
      else finish()
    }
  })
}

function finish() {
  log('Read ' + read + ' entities')
  log('Updated ' + updated + ' entities')
}
