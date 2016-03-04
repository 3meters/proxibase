/*
 * App config file
 */

module.exports = {
  service: {
    name: 'Proxibase',
    mode: 'production',                 // development | test | stage | production
    protocol: 'https',                  // https | http  (security tests require https)
    host: 'api.aircandi.com',
    host_external: 'api.aircandi.com',
    port: 443,                          // 443:production 8443:stage
    ssl: {
      keyFilePath: './keys/prod/aircandi.pem',
      certFilePath: './keys/prod/aircandi.com.crt',
      caFilePath: [
	'./keys/prod/gd_bundle-g2-g1.crt',
      ]
    },
    dkim: {                             // for digitally signing mail, see http://dkimcore.org/
      domainName: 'aircandi.com',
      keyFilePath: './keys/prod/mail.aircandi.com.pri',
      keySelector: 'feb2014.3meters',
    }
  },
  log: 1,                               // 0-3 higher numbers mean more log output
  logSlow: 1000,			// log to stderr responses taking longer than this in ms
  logDir: '/var/log/prox',              // Directory containing log files
  fullStackTrace: 1,
  db: {
    host: 'localhost',
    port: 27017,
    database: 'prox',                    // dev:prox test:smokeData stage:stage production:prox
    logSlow: 100,
  },
  state: {                              // Bootstrap state vars.  If vars already exist in the db no-op.
    clientMinVersions: {
      'com_aircandi_aruba': 1,
      'com_aircandi_catalina': 1,
    },
    'task.calcStats': {
      key: "task.calcStats",
      name: "calcStats",
      schedule: {schedules: [{s: [38]}]},
      module: "utils",
      method: "calcStats",
      args: [],
      enabled: true,
    },
  },
  maxWorkers: 2,
  ignoreTasks: false,
  sendNotifications: true,
  sendMail: true,
  notify: {
    onStart: true,
    onCrash: false,
    onFeedback: true,
    to: 'sos2014@3meters.com'
  }
}
