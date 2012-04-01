/*
 * Perform integrity checks on the database
 */

var
  cli = require('commander'),  // command line interface
  checkOrphans = require(__dirname + '/../../lib/admin/integrity').checkOrphans

cli
  .option('-d, --database <database>', 'database name [prox]', String, 'prox')
  .parse(process.argv)

checkOrphans(cli.database, null)
