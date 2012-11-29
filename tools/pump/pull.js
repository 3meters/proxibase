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
  case 'test':
    baseUri = 'https://localhost:6644'
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
  req.get(options, function(err, res) {
    if (err) throw err
    if (res.statusCode !== 200) throw new Error('Unexpected statusCode: ' + res.statusCode)
    var body = JSON.parse(res.body)
    // Don't save admin user.  It is created by service on startup
    if (tableName === 'users') {
      var users = []
      body.data.forEach(function(user) {
        if (user._id !== '0000.000000.00000.000.000000') users.push(user)
      })
      body.data = users
    }
    save(body.data, tableName)
    console.log(tableName + ': ' + body.data.length)
    if (body.more) console.log('Warning: did not fetch all records')
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
