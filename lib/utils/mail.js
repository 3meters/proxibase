/**
 * util/mail.js
 *
 * Sends a mail via system sendmail. Not tested on Windows
 */

var assert = require('assert')
  , mailer = require('nodemailer')

exports.sendMail = function(message, fn) {

  // Not loaded until runtime call to avoid circular util dependency
  var config = require('util').config

  assert(message && message.to && (message.subject || message.body),
      'Invalid call to notify.sendMail')

  var defaultFrom = config.service.name + ' Robot <noreply@' + 
      config.service.host + '>'

  message.from = message.from || defaultFrom
  var transport = mailer.createTransport('Sendmail')
  transport.sendMail(message, fn)
}

