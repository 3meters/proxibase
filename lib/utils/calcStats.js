/**
 * utils/calcStats.js
 *
 *   Trigger a stats refresh or optional build.  Indended as a cron job
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

  var timer = util.timer()
  db.tos[method](options, function(err) {

    if (err) {
      logErr('Error util.calcStats ' + method + ' tos:', err)
      return
    }

    db.froms[method](options, function(err) {

      if (err) {
        logErr('Error util.calcStats ' + method + ' froms:', err)
        return
      }

      log('Link stats refreshed in ' + timer.read() + ' ms on ' + util.nowUTC())
    })
  })
}
