/**
 * util/mail.js
 *
 * Sends a mail via system sendmail.
 *
 *   Sendmail can be installed
 *   on windows, but it is not there by default.  Set config.sendMail
 *   to false to skip sending mail or to a valid file name
 *   to log a copy of the mail that would have been sent.
 *
 *   Called syncronously since mail is so flaky there's nothing
 *   the caller could do on any type of failure
 */

var fs = require('fs')
var mailer = require('nodemailer')
var transport = mailer.createTransport('Sendmail')

var util = require('./')
var service = util.config.service


// Optionally sign mail with dkim
if (service.dkim && service.dkim.keyFilePath) {
  var options = {
    domainName: service.dkim.domainName,
    privateKey: fs.readFileSync(service.dkim.keyFilePath),
    keySelector: service.dkim.keySelector,
  }
  transport.useDKIM(options)
}

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
        return transport.sendMail(message, finish)
      }
      break

    case 'string':
      var str = '\n' + util.nowFormatted() + '\n' + util.inspect(message) + '\n\n'
      fs.appendFile(config.sendMail, str)
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
    else {
      log('mail sent', {
        to: message.to,
        subject: message.subject,
        result: result,
      })
    }
  }
}
