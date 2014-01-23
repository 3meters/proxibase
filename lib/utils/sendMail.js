/**
 * util/mail.js
 *
 * Sends a mail via system sendmail.  Sendmail can be installed
 *   on windows, but it is not there by default.  Set config.sendMail
 *   to false to skip sending mail or to a valid file name
 *   to log a copy of the mail that would have been sent.
 *
 *   Called syncronously since mail is so flaky there's nothing
 *   the caller could do on any type of failure
 */

var fs = require('fs')
var mailer = require('nodemailer')

module.exports = function(message) {

  // config can be set after server init
  var util = require('./')
  var config = util.config

  if (!(message && message.to && (message.subject || message.body))) {
    return logErr('Invalid call to util.mail', message)
  }

  var defaultFrom = config.service.name + ' Robot <noreply@' +
      config.service.host + '>'

  message.from = message.from || defaultFrom

  switch (tipe(config.sendMail)) {
    case 'boolean':
      if (config.sendMail) {
        var transport = mailer.createTransport('Sendmail')
        return transport.sendMail(message, finish)
      }
      break

    case 'string':
      fs.appendFile(
        config.sendMail,
        util.nowFormatted + '\n' + util.inspect(message) + '\n\n',
        finish
      )
      break

    default:
      delete message.body
      log('mail not sent', message)
  }

  function finish(err, result) {
    if (err) {
      message.error = err.stack||err
      logErr('Error sending mail', message)
    }
    delete message.body
    message.mailerResult = result
    log('mail sent', message)
  }
}
