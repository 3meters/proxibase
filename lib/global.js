/**
 * global.js
 *
 *    Extend node's global namespace
 */

var util = require('proxutils')

var proxGlobal = {
  util: util,
  _: util._,
  log: util.log,
  logErr: util.logErr,
  type: util.type,
  tipe: util.type,
  chk: util.chk,
  perr: util.perr,
  db: util.db,
  proxErr: util.proxErr,
}

for (var g in proxGlobal) {
  global[g] = proxGlobal[g]
}

