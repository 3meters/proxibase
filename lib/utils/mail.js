/**
 * util/mail.js
 *
 * Sends a mail via system sendmail.  Sendmail can be installed
 *   on windows, but it is not there by default.  Set config.sendMail
 *   to false to skip sending mail or to a valid file name
 *   to log a copy of the mail that would have been sent.
 */


var fs = require('fs')
var mailer = require('nodemailer')
var util = require('./')
var config = util.config
var type = util.type

exports.sendMail = function(message, cb) {

  if (!(message && message.to && (message.subject || message.body))) {
    return cb(new Error('Invalid call to util.mail'))
  }

  var defaultFrom = config.service.name + ' Robot <noreply@' +
      config.service.host + '>'
  message.from = message.from || defaultFrom

  switch (type(config.sendMail)) {
    case 'undefined':
      break
    case 'boolean':
      if (config.sendMail) {
        var transport = mailer.createTransport('Sendmail')
        transport.sendMail(message, cb)
      }
      break
    case 'string':
      fs.appendFile(config.sendMail, message, function(err) {
        return cb(err)
      })
      break
    default:
      cb(new Error('Invalid call to util.mail'))
  }
  cb() // noop
}
