/*
 * pullProx: suck prox data into json files
 */


var
  fs = require('fs'),
  assert = require('assert'),
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
    'beaconsets',
    'observations'
  ]

loadTable(tables.length, done)

function loadTable(iTable, cb) {
  if (!iTable--) return cb

  var tableName = tables[iTable]
  var options = {
    headers: { "content-type": "application/json" }
  }
  options.uri =  baseUri + '/' + tableName
  req.get(options, function(err, res) {
    if (err) throw err
    if (res.statusCode === 200) {
      var body = JSON.parse(res.body)
      fs.writeFileSync('./files/' + tableName + '.json', JSON.stringify(body.data))
    } else {
      console.log('Status code ' + res.statusCode + ' for table ' + tableName)
    }
    loadTable(iTable, cb)
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
