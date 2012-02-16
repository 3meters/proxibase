var https = require('https');
var util = require('util');
var fs = require('fs');

var proxModels = {
  0: "users",
  1: "beacons",
  2: "entities",
  3: "drops",
  4: "comments",
  5: "documents",
  6: "beaconsets"
};

var candiModels = {
  0: "User",  // 5
  1: "BeaconSets",  // 2
  2: "Comments", // 21 
  3: "Documents", // 1
  4: "Beacons", // 6
  5: "Entities", // 76
  6: "EntityTypes" // 6 
};

var tables = [];
var tableNames= [];

tables[0] = JSON.parse(fs.readFileSync('entities.json'));
tableNames[0] = 'entities';
console.log("entities: " + tables[0].length); 

tables[1] = JSON.parse(fs.readFileSync('drops.json'));
tableNames[1] = 'drops';
console.log("drops: " + tables[1].length);

var options = {
    host: "api.localhost",
    port: 8043,
    headers:  {"content-type": "application/json"},
    method: "post"
  }

function loadTable(iTable) {
  if (iTable >= tables.length) return done(); // break recursion
  loadDoc(tables[iTable], 0, tableNames[iTable], function() {
    iTable++;
    loadTable(iTable); // recurse
  });
}

function loadDoc(docs, iDoc, tableName, next) {

  if (iDoc >= docs.length) return next(); // break recursion

  options.path = "/" + tableName;

  var req = https.request(options, onRes);
  var json = JSON.stringify({ data: docs[iDoc] });
  req.write(json);
  req.end();

  function onRes(res) {
    res.on('error', function(e) { throw e });
    res.on('data', function(data) {
      console.log(iDoc + ': ' + util.inspect(JSON.parse(data)));
    });
    res.on('end', function() {
      iDoc++;
      loadDoc(docs, iDoc, tableName, next); // recurse
    });
  }
}

function done() {
  process.exit(0);
}

loadTable(0);

