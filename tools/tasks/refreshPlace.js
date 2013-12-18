// Insert the place scrubber task into a running server

var later = require('later')
var util = require('proxutils')

var host = 'https://api.aircandi.com'
var host = 'https://localhost:6643'
var adminpw = 'admin'
var schedule =  later.parse.cron('* */15 * * * *', true) // every 15 minutes


// accept unsigned certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0


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
    insertTask(body.session.key)
  })

function insertTask(session) {
  util.log('schedule', schedule)
  var task = {
    name: 'refreshPlace',
    schedule: schedule,
    module: 'utils',
    method: 'db.places.refreshNext',
    args: []
  }
  util.request
    .post(host + '/data/tasks')
    .query({user: util.adminUser._id})
    .query({session: session})
    .send({data: task})
    .end(function(err, res, body) {
      if (err) throw err
      util.log(body)
    })
}
