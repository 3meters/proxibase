/**
 * extend/index.js
 *
 *   Load proxibase extensions to node util and other third-party libraries
 */

require('./util')
require('./error').init()
require('./http')
console.log('Loaded proxibase extensions')
