/*
 * Prixbase notification service
 */

var
  mailer = require('nodemailer'),
  util = require(__dirname + '/../util')


// Send server startup mail
module.exports.serverStarted = function(config) {

  var message = {
    subject: config.serviceName + ' started on ' + Date(),
    body: '\nService: ' + serviceUrl + '\n' + 
     'Commit log: https://github.com/georgesnelling/proxibase/commits/master'
  }
  sendMail(config, message)
}

// Sends a mail via an external smtp account to the 3meters notification alias
var sendMail = module.exports.sendMail = function(config, message) {
  assert(config, 'Invalid call to notify.sendMail. Missing config')

  message = message || {}
  message.to = config.notify.to
  message.subject = message.subject || config.serviceName + ' notification'
  message.body = message.body || ''

  mailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    use_authentication: true,
    ssl: true,
    user: config.notify.from,
    pass: config.serviceName + config.pwSeed,
    debug: true
  }

  var mail = mailer.send_mail(message, function(err, success) {
    if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
    else log('Notification mail sent')
  })
}
