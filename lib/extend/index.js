/**
 * extend/index.js
 *
 *   Load extensions to javascript, node, and other core libs
 */

require('./javascript')
require('./util')
require('./error').init()
require('./http')

