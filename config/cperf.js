/*
 * Proxibase config file
 */

module.exports = {
  service: {
    name: 'Proxibase',
    mode: 'development',                // development | test | production
    protocol: 'https',                  // https | http  (security tests require https)
    host: 'localhost',
    host_external: 'api.aircandi.com',
    port: 8443,                         // dev:8443, test:8443, stage:8443, production: 443
    ssl: {
      keyFilePath: './keys/dev/dev.pem',
      certFilePath: './keys/dev/dev.crt',
      caFilePath: null,
    },
    dkim: {                             // for digitally signing mail, see http://dkimcore.org/
      domainName: 'aircandi.com',       // default aircandi.com, matches our dkim public key at godadday
      keyFilePath: null,
      keySelector: null,
    },
  },
  log: 1,                               // 0-3 higher numbers mean more log output
  logSlow: 300,                        // err log request that take longer than ms to fulfull
  logDir: '/var/log/prox',              // Directory containing log files
  fullStackTrace: 0,                    // Set to 1 to include full stack traces
  requestLog: 0,                        // create a json-formated log of all requests, accepts file name
  db: {
    host: 'localhost',
    port: 27017,
    database: 'perf',
    limits: {
      default: 50,
      max: 1000,
      join: 1000,
    },
    timeout: 60000,
    deoptimize: false,                  // Turn off code that preprocesses certain slow mongodb queries
    logSlow: 100,                       // write individual queries greater than n milliseconds to stderr.
    keepTestDb: true,                  // If true do not overwrite when testing
    serverOps: {},                      // Override Mongodb.Server options
    dbOps: {},                          // Override Mongodb.Db options
  },
  state: {                              // Bootstrap state vars. Overrides those stored in db.
    clientMinVersions: {
      com_aircandi_catalina: 1,
      com_patchr_android: 1,
      com_3meters_patchr_ios: 108,
    },
  },
  maxWorkers: 1,                        // default 1. Values > 1 exercise clustering. -1 means one worker per cpu core.
  ignoreTasks: true,                    // default true, if false autostart of recurring tasks on startup
  doNotRestart: false,                  // default false, if true do not restart dead workers, necessay for most tests.
  sendNotifications: false,             // default false, enable push notifications to android and iPhone clients
  sendMail: false,                      // default false, true to send emails or filename for logging
  notify: {                             // when to whom to send server alert mail
    onStart: false,
    onCrash: false,
    onFeedback: false,
    to: 'pager2010@3meters.com',
  },
}
