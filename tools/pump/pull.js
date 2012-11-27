/*
 * pull: suck all data from a proxibase server into local json files via the public rest API
 *
 * Usage:
 *
 *    node pull
 *
 *    node pull --help
 */

var
  fs = require('fs'),
  program = require('commander'),
  req = require('request'),
  tables = [],
  baseUri = ''

// parse command line options

program
  .option('-s --server <server>', 'server to pull data from [dev|prod|uri]', String, 'dev')
  .option('-o, --out <files>', 'output direcotry [files]', String, 'files')
  .parse(process.argv)

// set server URI baseed on command line switch.  default is local dev machine

switch(program.server) {
  case 'dev':
    baseUri = 'https://localhost:6643'
    break
  case 'prod':
    baseUri = 'https://api.aircandi.com:643'
    break
  default:
    baseUri = program.server
}

// get table names from target server

req.get(baseUri + '/schema', function (err, res) {
  if (err) throw err
  if (res.statusCode !== 200) throw new Error('Unexpected statusCode: ' + res.statusCode)
  var body = JSON.parse(res.body)
  for (var tableName in body.schemas) {
    tables.push(tableName)
  }
  pullTable(tables.length, done)
})

// pull data async in series

function pullTable(iTable, cb) {
  if (!iTable--) return cb
  var tableName = tables[iTable]
  var options = {
    headers: { "content-type": "application/json" }
  }
  options.uri =  baseUri + '/data/' + tableName
  console.log(options.uri)
  req.get(options, function(err, res) {
    if (err) throw err
    if (res.statusCode !== 200) throw new Error('Unexpected statusCode: ' + res.statusCode)
    var body = JSON.parse(res.body)
    save(body.data, tableName)
    pullTable(iTable, cb)
  })
}

function save(tbl, name) {
  if (!fs.existsSync(program.out)) fs.mkdirSync(program.out)
  fs.writeFileSync(program.out + '/' + name + '.json', JSON.stringify(tbl))
}

function done() {
  console.log('Finished')
  process.exit(0)
}
