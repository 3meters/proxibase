/**
 * global.js
 *
 *    Polute the global namespace
 */

var util = require('proxutils')

var proxGlobal = {
  util: util,
  _: util._,
  log: util.log,
  logErr: util.logErr,
  debug: util.debug,
  tipe: util.tipe,
  scrub: util.scrub,
  db: util.db,
  proxErr: util.proxErr,
  perr: util.perr,
  statics: util.statics,
}

for (var g in proxGlobal) {
  global[g] = proxGlobal[g]
}
