/*
 * pull: suck all data from a proxibase server into local json files via the public rest API
 */

var
  fs = require('fs'),
  path = require('path'),
  assert = require('assert'),
  program = require('commander'),
  baseUri = 'https://api.localhost:8043',
  req = require('request'),
  tables = []

// parse command line options

program
  .option('-s --server <server>', 'server to pull data from [dev|prod|uri]', String, 'dev')
  .option('-o, --out <files>', 'output direcotry [files]', String, 'files')
  .parse(process.argv)

// set server URI baseed on command line switch.  default is local dev machine

switch(program.server) {
  case 'dev':
    baseUri = 'https://api.localhost:8043'
    break
  case 'prod':
    baseUri = 'https://api.proxibase.com'
    break
  case 'uri':
    baseUri = program.server
    break
  default:
    console.error('Invalid value for --server')
    process.exit(1)
}

// get table names from target server

req.get(baseUri + '/__info', function (err, res) {
  if (err) throw err
  if (!res) throw new Error('No response')
  if (res.statusCode !== 200) throw new Error('Unexpected statusCode: ' + res.statusCode)
  var tableMap = JSON.parse(res.body)
  for (var tableName in tableMap) {
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
  options.uri =  baseUri + '/' + tableName
  req.get(options, function(err, res) {
    if (err) throw err
    if (res.statusCode !== 200) throw new Error('Unexpected statusCode: ' + res.statusCode)
    var body = JSON.parse(res.body)
    save(body.data, tableName)
    pullTable(iTable, cb)
  })
}

function save(tbl, name) {
  if (!path.existsSync(program.out)) fs.mkdirSync(program.out)
  fs.writeFileSync(program.out + '/' + name + '.json', JSON.stringify(tbl))
}

function done() {
  console.log('Finished')
  process.exit(0)
}
