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
  perr: util.perr,
  proxErr: util.proxErr,
}

for (var g in proxGlobal) {
  global[g] = proxGlobal[g]
}
