/*
 * push: loads proxibase data files into a proxibase server via the rest api
 *
 * Usage:
 *
 *    node push
 *
 *    node push --help
 */

var
  fs = require('fs'),
  path = require('path')
  program = require('commander'),
  req = require('request'),
  log = require('../../lib/util').log,
  tables = [],
  tableNames= [],
  errors = []

program
  .option('-s --server <dev>', 'push to server [dev|test|prod|url]', String, 'dev')
  .option('-i --in <files>', 'input direcotry [files]', String, 'files')
  .option('-q --quiet', 'do not log sucessful inserts')
  .parse(process.argv)

// set server URI baseed on command line switch.  default is local dev machine

switch(program.server) {
  case 'dev':
    baseUri = 'https://api.localhost:8043'
    break
  case 'test':
    baseUri = 'https://api.proxibase.com:8043'
    break
  case 'prod':
    baseUri = 'https://api.proxibase.com:443'
    break
  default:
    baseUri = program.server
}

readFiles(program.in)
loadTable(0)

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
  loadDoc(tables[iTable], 0, tableNames[iTable], function() {
    iTable++
    loadTable(iTable) // recurse
  })
}

function loadDoc(docs, iDoc, tableName, next) {

  if (iDoc >= docs.length) return next() // break recursion

  var options = {}, statusMsg = ''
  options.headers = {"content-type":"application/json"}
  options.uri = baseUri + '/' + tableName
  options.body = JSON.stringify({ data: docs[iDoc] })
  req.post(options, function(err, res) {
    if (err) throw err
    if (!res) throw new Error('No response')
    if (res.statusCode !== 200) {
      statusMsg = '  statusCode: ' + res.statusCode
      errors.push({
        statusCode: res.statusCode,
        table: tableName,
        iDoc: iDoc,
        data: docs[iDoc],
        error: JSON.parse(res.body)
      })
    }
    if (!program.quiet) log(tableName + ': ' + iDoc + statusMsg, JSON.parse(res.body))
    iDoc++
    loadDoc(docs, iDoc, tableName, next) // recurse
  })
}

function done() {
  if (errors.length) log('\nFinished with ' + errors.length + ' error(s)', errors, false, 5)
  else log('\nFinished ok')
  process.exit(errors.length)
}

