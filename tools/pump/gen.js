/*
 * Command line interface for genData
 *
 * Usage:
 *
 *    node gen
 *    node gen --help
 */
var
  genData = require('./genData'),
  cli = require('commander')  // command line interface

cli
  .option('-b, --beacons <num>', 'beacons to generate [3]', Number, 3)
  .option('-e, --epb <num>', 'entities per beacon [5]', Number, 5)
  .option('-s, --spe <num>', 'sub entities per entity [5]', Number, 5)
  .option('-c, --cpe <num>', 'comments per entity [5]', Number, 5)
  .option('-d, --database <database>', 'database name [proxTest]', String, 'proxTest')
  .option('-f, --files', 'create files rather than update the database')
  .option('-o, --out <dir>', 'output directory for files [files]', String, 'files')
  .parse(process.argv)

genData.generateData(cli)