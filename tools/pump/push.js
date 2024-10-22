/**
 * push: loads proxibase data files into a proxibase server via the rest api
 *
 * Usage:
 *
 *    node push
 *
 *    node push --help
 */

var fs = require('fs')
var path = require('path')
var program = require('commander')
var req = require('request')
var util = require('proxutils')
var log = util.log
var testUtil = require('../../test/util')
var tables = []
var tableNames= []
var errors = []
var adminCred = ''


// Parse command line options
program
  .option('-s --server <dev>',
      'push to server [dev|test|prod|stage|uri]', String, 'dev')
  .option('-i --in <files>',
      'input direcotry [files]', String, 'files')
  .option('-v --validate <validate>',
      'validate data on insert, sets sys fields')
  .parse(process.argv)


// Set server URI baseed on command line switch.  default is local dev machine
switch(program.server) {
  case 'dev':
    baseUri = 'https://localhost:6643'
    break
  case 'test':
    baseUri = 'https://localhost.com:6644'
    break
  case 'prod':
    baseUri = 'https://api.aircandi.com'
    break
  case 'stage':
    baseUri = 'https://api.aircandi.com:444'
  default:
    baseUri = program.server
}


// Read files to push
readFiles(program.in)
testUtil.serverUrl = baseUri
testUtil.getAdminSession(function(session) {
  adminCred = 'user=' + session._owner + '&session=' + session.key
  loadTable(0)
})


// Synchronously read all json files from dir assuming dir and files are well-formed
function readFiles(dir) {
  var fileNames = fs.readdirSync(dir)
  fileNames.forEach(function (fileName) {
    if (path.extname(fileName) === '.json') {
      tables.push(JSON.parse(fs.readFileSync(dir + '/' + fileName)))
      tableNames.push(path.basename(fileName, '.json'))
    }
  })
}

// Load a table from a file
function loadTable(iTable) {
  if (iTable >= tables.length) return done() // break recursion
  loadDoc(tables[iTable], 0, 0, tableNames[iTable], function() {
    iTable++
    loadTable(iTable) // recurse
  })
}

// Load a record
function loadDoc(docs, iDoc, cLoaded, tableName, next) {
  if (iDoc >= docs.length) {
    log(tableName + ': ' + cLoaded)
    return next() // break recursion
  }

  var options = {}, statusMsg = ''
  options.headers = {"content-type":"application/json"}
  options.uri = baseUri + '/data/' + tableName + '?' + adminCred
  var body = {
    data: docs[iDoc],
    skipValidation: true
  }
  if (program.validate) delete body.skipValidation
  options.body = JSON.stringify(body)

  req.post(options, function(err, res) {
    if (err) throw err
    if (res.statusCode === 201) cLoaded++
    else {
      statusMsg = '  statusCode: ' + res.statusCode
      errors.push({
        statusCode: res.statusCode,
        table: tableName,
        iDoc: iDoc,
        data: docs[iDoc],
        error: JSON.parse(res.body)
      })
    }
    iDoc++
    loadDoc(docs, iDoc, cLoaded, tableName, next) // recurse
  })
}

// Finish
function done() {
  if (errors.length) {
    console.error('\nFinished with ' + errors.length + ' error(s)')
    console.error(util.inspect(errors, false, 5))
  }
  else log('\nFinished ok')
  process.exit(errors.length)
}

