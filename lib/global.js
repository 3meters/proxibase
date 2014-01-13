/**
 * global.js
 *
 *    Polute the global namespace
 */

var proxutils = require('proxutils')

var proxGlobal = {
  util: proxutils,
  _: proxutils._,
  log: proxutils.log,
  logErr: proxutils.logErr,
  debug: proxutils.debug,
  tipe: proxutils.tipe,
  scrub: proxutils.scrub,
  db: proxutils.db,
  proxErr: proxutils.proxErr,
  perr: proxutils.perr,
  statics: proxutils.statics,
}

for (var g in proxGlobal) {
  global[g] = proxGlobal[g]
}
