/**
 * migrate proxibase database from version 4 to version 5
 *
 * reads json files from ./old containing all data from version 4
 * writes json files to ./new containing all transformed data for verstion 5
 *
 * Purpose:  remap all ids from old collection prefixes to new
 *
 * Since this is a file-to-file transform, all calls are synchronous.  The entire
 * db is read into RAM brute force, so this won't work for real production data
 * but seems to work fine for small data sets.
 */


var fs = require('fs')
var req = require('request')
var util = require('util')

if (!util.truthy) require('../../../lib/extend') // Use proxibase extensions
var log = util.log

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

// Load the whole db into memory
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

// If the field's value looks like a proxibase id swap the old prefix for the new
function fixField(field) {
  if (util.typeOf(field) !== 'string') return field
  oldIds.some(function(id, i) {
    if (field.indexOf(id) === 0) {
      field = newIds[i] + '.' + field.slice(5)
      return true // breaks out of a some loop
    }
  })
  return field
}

function transformIds() {
  for (var tableName in tables) {
    tables[tableName].forEach(function(row) {
      for (var fieldName in row) {
        if (util.typeOf(row[fieldName]) === 'array') { // mongoose array field, e.g. entities.comments
          row[fieldName].forEach(function(subRow) {
            for (var subRowFieldName in subRow) {
              subRow[subRowFieldName] = fixField(subRow[subRowFieldName])
            }
          })
        }
        else { // regular field
          row[fieldName] = fixField(row[fieldName])
        }
      }
    })
  }
}

// Fixup, rename, and retype the links tableIds to collectionIds
function fixLinkTargets() {
  tables['links'].forEach(function(row) {
    row.toCollectionId = row._to.slice(0,4)
    row.fromCollectionId = row._from.slice(0,4)
    delete row.toTableId
    delete row.fromTableId
  })
}

// Fixup, rename, and retype action targetTableId to targetCollectionId
function fixActionTargets() {
  tables['actions'].forEach(function(row) {
    row.targetCollectionId = row._target.slice(0,4)
    delete row.targetTableId
  })
}


function write() {
  for(var tableName in tables) {
    fs.writeFileSync('./new/' + tableName + '.json', JSON.stringify(tables[tableName]))
    log(tables[tableName].length + ' ' + tableName)
  }
}


read()
transformIds()
fixLinkTargets()
fixActionTargets()
write()

