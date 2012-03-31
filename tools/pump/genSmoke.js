/*
 * Generates standardized database for smoke testing before
 * checkins. The data profile used is in constants and is shared
 * with the checkin unit tests.
 */
var
  genData = require(__dirname + '/genData'),
  constants = require(__dirname + '/../../test/constants')

genData.generateData(constants.smokeDataProfile)
