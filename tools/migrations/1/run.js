var
  fs = require('fs'),
  _baseUri = 'https://api.localhost:8043',
  baseUri = 'https://api.proxibase.com:443',
  req = require('request'),
  tables = [
    'users',
    'beacons',
    'entities',
    'drops',
    'comments',
    'documents',
    'beaconsets'
  ]

processTable(tables.length, done)

function processTable(iTable, cb) {
  if (!iTable--) return cb

  var tableName = tables[iTable]

  var json = fs.readFileSync('./old/' + tableName + '.json', 'utf8')
  var rows = JSON.parse(json)
  var newRows = rows
  var newJson = JSON.stringify(newRows)
  fs.writeFileSync('./new/' + tableName + '.json', newJson)
  processTable(iTable, cb)
}

function done() {
  console.log('Finished')
  process.exit(0)
}
