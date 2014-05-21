// Insert common tasks into the server

var later = require('later')
var util = require('proxutils')
var async = require('async')
var log = util.log

var host = 'https://api.aircandi.com'
// var host = 'https://localhost:6643'
var adminpw = ''

// accept unsigned certs from test or dev boxes
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

function run() {
  var session

  // Sample cron parser: every 15 minutes, 15 seconds after the minute
  var schedule = later.parse.cron('15 */15 * * * *', true)

  var tasks = [
    {
      name: 'refreshPlace',
      schedule: {schedules: [{s: [15], m: [2,17,32,47]}]},
      module: 'utils',
      method: 'db.places.refreshNext',
      enabled: true,
      args: [],
    },
    {
      name: 'calcStats',
      schedule: {schedules: [{s: [37], m: [7,17,27,37,47,57]}]},
      module: 'utils',
      method: 'calcStats',
      enabled: true,
      args: [],
    }
  ]

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
      async.eachSeries(tasks, upsertTask, finish)
    })

  function upsertTask(task, nextTask) {
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
        postTaskDoc(id)
      })

    function postTaskDoc(id) {
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
          util.log(task.name + ' result:', body)
          nextTask()
        })
    }
  }

  function finish(err) {
    if (err) throw err
    log('Tasks upserted')
  }
}

run()
