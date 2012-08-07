/*
 * Prixbase notification service
 */

var
  assert = require('assert'),
  mailer = require('nodemailer'),
  defaultFrom = '<Proxibase Robot<noreply@proxibase.com>',
  util = require(__dirname + '/../util'),
  config = util.config,
  log = util.log


// Send server startup mail to the 3meters notification alias
module.exports.serverStarted = function(config) {

  var message = {
    to: config.notify.to,
    from: defaultFrom,
    subject: config.service.name + ' started on ' + Date(),
    body: '\nService: ' + config.service.url + '\n' + 
     'Commit log: https://github.com/georgesnelling/proxibase/commits/master\n\n' +
     'Config: \n' + util.inspect(config) + '\n'
  }
  sendMail(message, function(err, res) {
    if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
    else log('Notification mail sent')
  })
}


// Sends a mail via system sendmail. Not tested on Windows
var sendMail = module.exports.sendMail = function(message, fn) {

  assert(message && message.to && (message.subject || message.body),
      'Invalid call to notify.sendMail)

  message.from = message.from || defaultFrom
  var transport = mailer.createTransport('Sendmail')
  transport.sendMail(message, fn)
}
