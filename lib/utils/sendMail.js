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

module.exports = function(message, cb) {

  // config can be set after server init
  var util = require('./')
  var config = util.config

  if (!(message && message.to && (message.subject || message.body))) {
    return cb(new Error('Invalid call to util.mail'))
  }

  var defaultFrom = config.service.name + ' Robot <noreply@' +
      config.service.host + '>'
  message.from = message.from || defaultFrom

  switch (tipe(config.sendMail)) {
    case 'undefined':
      return cb()
      break
    case 'boolean':
      if (config.sendMail) {
        var transport = mailer.createTransport('Sendmail')
        return transport.sendMail(message, cb)
      }
      else return cb()
      break
    case 'string':
      fs.appendFile(
        config.sendMail,
        util.nowFormatted + '\n' + util.inspect(message) + '\n\n',
        function(err) { return cb(err) }
      )
      break
    default:
      cb(new Error('Invalid call to util.sendMail'))
  }
}