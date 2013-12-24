// Insert the place scrubber task into a running server

var later = require('later')
var util = require('proxutils')
var log = util.log

var host = 'https://api.aircandi.com'
// var host = 'https://localhost:6643'
var adminpw = '' // remember to take out before pushing

// accept unsigned certs from test or dev boxes
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

function run() {
  var session
  var schedule =  later.parse.cron('15 */15 * * * *', true) // every 15 minutes, 15 seconds after the minute
  var task = {
    name: 'refreshPlace',
    schedule: schedule,
    module: 'utils',
    method: 'db.places.refreshNext',
    args: [],
  }

  log('getting session from ' + host)
  util.request
    .post(host + '/auth/signin')
    .send({
      email: 'admin',
      password: adminpw,
      installId: '0',
    })
    .end(function(err, res, body) {
      if (err) throw err
      if (!body.session) throw new Error(res.text)
      session = body.session.key
      log('have session')
      findTask()
    })

  function findTask() {
    log('searching for existing task ', task.name )
    util.request
      .post(host + '/find/tasks')
      .query({user: util.adminUser._id})
      .query({session: session})
      .send({query: {name: task.name}})
      .end(function(err, res, body) {
        if (err) throw err
        util.log('response', body)
        var id = null
        if (body && body.data && body.data[0]) id = body.data[0]._id
        upsertTask(id)
      })
  }

  function upsertTask(id) {
    var uri = host + '/data/tasks'
    if (id) uri += '/' + id
    util.log('upserting ', uri)
    util.request
      .post(uri)
      .query({user: util.adminUser._id})
      .query({session: session})
      .send({data: task})
      .end(function(err, res, body) {
        if (err) throw err
        util.log('Result', body)
      })
  }
}

run()
