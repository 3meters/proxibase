/**
 * util/mail.js
 *
 * Sends a mail via system sendmail. Not tested on Windows
 */


var assert = require('assert')
var mailer = require('nodemailer')
var util = require('./')
var config = util.config

exports.sendMail = function(message, fn) {

  assert(message && message.to && (message.subject || message.body),
      'Invalid call to notify.sendMail')

  var defaultFrom = config.service.name + ' Robot <noreply@' + 
      config.service.host + '>'

  message.from = message.from || defaultFrom
  var transport = mailer.createTransport('Sendmail')
  transport.sendMail(message, fn)
}

