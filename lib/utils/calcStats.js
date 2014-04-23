/**
 * utils/calcStats.js
 *
 *   Trigger a stats refresh.  Indended as a cron job
 *
 */

module.exports = function() {

  var options = {asAdmin: true}

  db.tos.refresh(options, function(err) {

    if (err) logErr('Error util.calcStats tos refresh:', err)
    log('tos refreshed ' + util.nowUTC())

    db.froms.refresh(options, function(err) {

      if (err) logErr('Error util.calcStats froms refresh:', err)
      log('froms refreshed ' + util.nowUTC())

    })
  })
}
