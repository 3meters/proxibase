// Insert common tasks into the server

var later = require('later')
var util = require('proxutils')
var async = require('async')
var log = util.log

var host = 'https://api.aircandi.com/v1'
// var host = 'https://localhost:6643/v1'
var adminpw = 'Richard2010'

// accept unsigned certs from test or dev boxes
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

function run() {
  var session

  // Sample cron parser: every 15 minutes, 15 seconds after the minute
  var schedule = later.parse.cron('15 */15 * * * *', true)

  var tasks = [
    /*
    {
      name: 'refreshPlace',
      schedule: {schedules: [{s: [15], m: [2,17,32,47]}]},
      module: 'utils',
      method: 'db.places.refreshNext',
      enabled: true,
      args: [],
    },
    */
    {
      key: 'task.calcStats',
      name: 'calcStats',
      schedule: {schedules: [{s: [38]}]},  // every minute on the 37th second
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
    log('upserting task ', task.name )
    util.request
      .get(host + '/admin/tasks/' + task.key)
      .query({user: util.adminUser._id})
      .query({session: session})
      .end(function(err, res, body) {
        var url = host + '/admin/tasks'
        if (body.task) url += '/' + task.key
        util.request
          .post(url)
          .query({user: util.adminUser._id})
          .query({session: session})
          .send(task)
          .end(function(err, res, body) {
            if (err) throw err
            util.log('response', body)
            nextTask()
          })
      })
  }

  function finish(err) {
    if (err) throw err
    log('Tasks upserted')
  }
}

run()
