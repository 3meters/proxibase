/*
 * Util Mail
 * Sends a mail via system sendmail. Not tested on Windows
 */

var
  assert = require('assert')
  mailer = require('nodemailer')

exports.sendMail = function(message, fn) {

  assert(message && message.to && (message.subject || message.body),
      'Invalid call to notify.sendMail')

  var defaultFrom = '<Proxibase Robot<noreply@proxibase.com>'

  message.from = message.from || defaultFrom
  var transport = mailer.createTransport('Sendmail')
  transport.sendMail(message, fn)
}


