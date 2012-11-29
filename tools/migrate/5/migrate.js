/*
 * migrate proxibase database from version 4 to version 5
 *
 * reads json files from ./old containing all data from version 4
 * writes json files to ./new containing all transformed data for verstion 5
 *
 * Since this is a file-to-file transform, all calls are synchronous
 *
 */


var fs = require('fs')
var req = require('request')
var util = require('util')
var log = util.log
var typeOf = util.typeOf

if (!util.truthy) require('../../../lib/extend') // Use proxibase extensions

var oldIds = [
  '0000', // users
  '9999', // accounts
  '0004', // sessions
  '0002', // entities
  '0001', // links
  '0009', // actions
  '0005', // documents
  '0003', // beacons
]

var newIds = [
  '0001', // users
  '0002', // accounts
  '0003', // sessions
  '0004', // entities
  '0005', // links
  '0006', // actions
  '0007', // documents
  '0008', // beacons
]

var tables = {
  users: true,
  links: true,
  entities: true,
  beacons: true,
  documents: true,
  actions: true
}

var tables = {
  entities: true
}

function read() {
  for (var tableName in tables) {
    try {
      var json = fs.readFileSync('./old/' + tableName + '.json', 'utf8')
      tables[tableName] = JSON.parse(json)
    } catch (e) {
      console.error('Could not read or parse ./old/' + tableName + ', skipping')
    }
  }
}

function fix(field) {
  if (util.typeOf(field) !== 'string') return field
  oldIds.some(function(id, i) {
    if (field.indexOf(id) === 0) {
      field = newIds[i] + '.' + field.slice(5)
      return true // breaks out of a some loop
    }
  })
  return field
}

function transform() {
  for (var tableName in tables) {
    tables[tableName].forEach(function(row) {
      for (var fieldName in row) {
        if (util.typeOf(row[fieldName]) === 'array') {
          row[fieldName].forEach(function(subField) {
            log(subField)
            subField = fix(subField)
            log(subField)
          })
        }
        else {
          row[fieldName] = fix(row[fieldName])
        }
      }
    })
  }
}

function write() {
  for(var tableName in tables) {
    fs.writeFileSync('./new/' + tableName + '.json', JSON.stringify(tables[tableName]))
  }
}


read()
transform()
write()
process.exit(0)


