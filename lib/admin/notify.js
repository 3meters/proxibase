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
    body: '\nService: ' + util.getUrl(config) + '\n' + 
     'Commit log: https://github.com/georgesnelling/proxibase/commits/master'
  }
  sendMail(config, message)
}

// Sends a mail via system sendmail to the 3meters notification alias
// Not tested on Windows
var sendMail = module.exports.sendMail = function(config, message) {
  assert(config, 'Invalid call to notify.sendMail. Missing config')

  var transport = mailer.createTransport('Sendmail')

  message = message || {}
  message.to = config.notify.to
  message.from = 'Proxibase Robot<noreply@proxibase.com>'
  message.subject = message.subject || config.serviceName + ' notification'
  message.body = message.body || ''

  transport.sendMail(message, function(err, res) {
    if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
    else log('Notification mail sent.')
  })

  /*
  mailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    use_authentication: true,
    ssl: true,
    user: config.notify.user,
    pass: config.serviceName + config.notify.pwSeed,
    debug: true
  }
  

  // log('mailer.SMTP', mailer.SMTP)


  var mail = mailer.send_mail(message, function(err, success) {
    if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
    else log('Notification mail sent')
  })

  */
}
