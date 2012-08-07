/*
 * Command line interface for proxibase notification service
 */ 

var
  cli = require('commander'),
  util = require(__dirname + '/../util'),
  notifiy = require(__dirname + '/notify'),
  message

cli
  .option('-t --to <recipiant>', 'Recipiant')
  .option('-f --from <sender>', 'Sender')
  .option('-s --subject <subject>', 'Subject')
  .option('-b --body <body', 'Body')
  .parse(process.argv)

if (cli.to) message.to = cli.to
if (cli.from) message.from = cli.from
if (cli.subject) message.subject = cli.subject
if (cli.body) message.body = cli.body


if (message.to && (message.body || message.subject)) {
  notify.sendMail(message, function(err, res) {
    if (err) throw err
    util.log('Message sent', res) 
  })
}
else {
  throw new Error('Invalid call.  to, subject, and body are required')
}


