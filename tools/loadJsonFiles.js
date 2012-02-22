/*
 * reads all .json files from the current working directory and loads them into proxibase via the rest api
 */

var 
  options = {
    host: "api.localhost",
    port: 8043,
    headers:  {"content-type": "application/json"},
    method: "post"
  },
  https = require('https'),
  log = require('../lib/log'),
  fs = require('fs'),
  tables = [],
  tableNames= []

exports.run = function(server, ext) {
  if (server === 'prod') {
    options.host = 'api.proxibase.com',
    options.port = 443
  }
  readFiles(ext)
  loadTable(0)
}

function readFiles(ext) {
  ext = ext || '.json'
  var fileNames = fs.readdirSync('.')
  for (var i = fileNames.length; i--;) {
    if (fileNames[i].indexOf(ext, fileNames[i].length - ext.length) < 0) fileNames.splice(i, 1)
  }
  log('files', fileNames)

  fileNames.forEach(function(fileName) {
    tables.push(JSON.parse(fs.readFileSync(fileName)))
    tableNames.push(fileName.slice(0, fileName.length - ext.length))
  })
  log('tables', tableNames)
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

  options.path = "/" + tableName

  var req = https.request(options, onRes)
  var json = JSON.stringify({ data: [docs[iDoc]] })
  req.write(json)
  req.end()

  function onRes(res) {
    var json = ''
    res.on('error', function(e) { throw e })
    res.on('data', function(data) {
      json += data
    })
    res.on('end', function() {
      var statusMsg = ''
      if (res.statusCode !== 200) statusMsg = '  statusCode: ' + res.statusCode
      log(tableName + ': ' + iDoc + statusMsg, JSON.parse(json))
      iDoc++
      loadDoc(docs, iDoc, tableName, next) // recurse
    })
  }
}

function done() {
  process.exit(0)
}


