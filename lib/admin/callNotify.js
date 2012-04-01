/*
 * Command line interface for proxibase notification service
 */ 

var
  cli = require('commander'),
  util = require(__dirname + '/../util'),
  notifiy = require(__dirname + '/notify'),
  configFile = 'config.js',
  config,
  message

cli
  .option('-s --subject <subject>', 'Subject')
  .option('-b --body <body', 'Body')
  .option('-c --configfile <file>', 'Config file [config.js]')
  .parse(process.argv)

if (cli.configfile) configFile = cli.configFile
config = util.findConfig(configFile)

if (cli.subject) message.subject = cli.subject
if (cli.body) message.body = cli.body

notify.sendMail(config, message)




