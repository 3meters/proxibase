/*
 * checkOrphans
 * 
 * Reports any links or observations that point to 
 * entities or beacons that do not exist.
 */

var checkOrphans = require('../admin/integrity').checkOrphans

exports.main = function(req, res) {
  checkOrphans(req.body.database, res)
}