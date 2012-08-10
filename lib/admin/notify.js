/*
 * Prixbase notification service
 */

var
  assert = require('assert'),
  mailer = require('nodemailer'),
  util = require(__dirname + '/../util'),
  config = util.config,
  log = util.log


// Send server startup mail
module.exports.serverStarted = function(config) {

  var message = {
    subject: config.service.name + ' started on ' + Date(),
    body: '\nService: ' + config.service.url + '\n' + 
     'Commit log: https://github.com/georgesnelling/proxibase/commits/master\n\n' +
     'Config: \n' + util.inspect(config) + '\n'
  }
  sendMail(config, message)
}


// Sends a mail via system sendmail to the 3meters notification alias
// Not tested on Windows
var sendMail = module.exports.sendMail = function(config, message) {
  assert(config, 'Invalid call to notify.sendMail. Missing config')


  message = message || {}
  message.to = config.notify.to
  message.from = 'Proxibase Robot<noreply@proxibase.com>'
  message.subject = message.subject || config.service.name + ' notification'
  message.body = message.body || ''

  var transport = mailer.createTransport('Sendmail')
  transport.sendMail(message, function(err, res) {
    if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
    else log('Notification mail sent')
  })

}
