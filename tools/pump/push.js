/*
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
var log = console.log
var util = require('util')
var testUtil = require('../../test/util')
var tables = []
var tableNames= []
var errors = []
var adminCred = ''

program
  .option('-s --server <dev>', 'push to server [dev|test|prod|prodtest|uri]', String, 'dev')
  .option('-i --in <files>', 'input direcotry [files]', String, 'files')
  .option('-q --quiet', 'do not log sucessful inserts')
  .parse(process.argv)

// set server URI baseed on command line switch.  default is local dev machine

switch(program.server) {
  case 'dev':
    baseUri = 'https://localhost:6643'
    break
  case 'test':
    baseUri = 'https://localhost.com:6644'
    break
  case 'prod':
    baseUri = 'https://api.aircandi.com:643'
    break
  case 'prodtest':
    baseUri = 'https://api.aircandi.com:644'
  default:
    baseUri = program.server
}


readFiles(program.in)
testUtil.serverUrl = baseUri
testUtil.getAdminSession(function(session) {
  adminCred = 'user=' + session._owner + '&session=' + session.key
  loadTable(0)
})

// synchronously read all json files from dir assuming dir and files are well-formed

function readFiles(dir) {
  var fileNames = fs.readdirSync(dir)
  fileNames.forEach(function (fileName) {
    if (path.extname(fileName) === '.json') {
      tables.push(JSON.parse(fs.readFileSync(dir + '/' + fileName)))
      tableNames.push(path.basename(fileName, '.json'))
    }
  })
}

function loadTable(iTable) {
  if (iTable >= tables.length) return done() // break recursion
  log('loading ' + tableNames[iTable])
  loadDoc(tables[iTable], 0, tableNames[iTable], function() {
    iTable++
    loadTable(iTable) // recurse
  })
}

function loadDoc(docs, iDoc, tableName, next) {

  if (iDoc >= docs.length) return next() // break recursion

  var options = {}, statusMsg = ''
  options.headers = {"content-type":"application/json"}
  options.uri = baseUri + '/data/' + tableName + '?' + adminCred
  options.body = JSON.stringify({ data: docs[iDoc] })

  req.post(options, function(err, res) {
    if (err) throw err
    if (res.statusCode !== 201) {
      statusMsg = '  statusCode: ' + res.statusCode
      errors.push({
        statusCode: res.statusCode,
        table: tableName,
        iDoc: iDoc,
        data: docs[iDoc],
        error: JSON.parse(res.body)
      })
      log(util.inspect(errors, false, 5))
      process.exit(1)
    }
    if (!program.quiet) {
      log(tableName + ': ' + iDoc + statusMsg)
      log(JSON.parse(res.body))
    }
    iDoc++
    loadDoc(docs, iDoc, tableName, next) // recurse
  })
}

function done() {
  if (errors.length) {
    log('\nFinished with ' + errors.length + ' error(s)')
    log(errors)
  }
  else log('\nFinished ok')
  process.exit(errors.length)
}

