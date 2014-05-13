/**
 * utils/calcStats.js
 *
 *   Trigger a stats refresh or build.  Indended as a cron job
 *
 */

module.exports = function(options) {

  options = options || {}

  options.asAdmin = true
  var method = 'refresh'
  if (options.rebuild) {
    method = 'rebuild'
    delete options.rebuild
  }

  db.tos[method](options, function(err) {

    if (err) logErr('Error util.calcStats ' + method + ' tos:', err)
    log('tos ' + method + ' ' + util.nowUTC())

    db.froms[method](options, function(err) {

      if (err) logErr('Error util.calcStats ' + method + ' froms:', err)
      log('froms ' + method + ' ' + util.nowUTC())

    })
  })
}
