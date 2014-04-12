/**
 * utils/calcStats.js
 *
 *   Trigger a stats refresh.  Indended as a cron job
 *
 */

module.exports = function(lastLinkId) {

  lastLinkId = lastLinkId || ''

  var options = {
    lastLinkId: lastLinkId,
    asAdmin: true
  }

  db.tos.refresh(options, function(err) {
    if (err) logErr('Error util.calcStats tos refresh:', err)
    log('tos refreshed from ' + lastLinkId + ' ' + util.nowUTC())
    db.froms.refresh(options, function(err) {
      if (err) logErr('Error util.calcStats froms refresh:', err)
      log('froms refreshed from ' + lastLinkId + ' ' + util.nowUTC())
    })
  })
}
