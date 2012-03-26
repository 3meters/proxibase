/*
 * Generates standardized database for smoke testing before
 * checkins. The data profile used is in constants and is shared
 * with the checkin unit tests.
 */
var
  genData = require('./genData'),
  constants = require('../../test/constants.js')

genData.generateData(constants.smokeDataProfile)