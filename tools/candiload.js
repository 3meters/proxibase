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

var entities = JSON.parse(fs.readFileSync('entities.json'));
console.log("entities: " + entities.length); 

var drops = JSON.parse(fs.readFileSync('drops.json'));
console.log("drops: " + drops.length);

var options = {
    host: "api.localhost",
    port: 8043,
    headers:  {"content-type": "application/json"}
  }

loadDocs(entities, 0);

function loadDocs(docs, i) {

  if (i >= docs.length) done(); // break recursion

  var req = https.request(options, onRes);
  var json = JSON.stringify({ data: docs[i] });
  req.write(json);
  req.end();

  function onRes(res) {
    res.on('error', function(e) { throw e });
    res.on('data', function(data) {
      console.log(i + ': ' + util.inspect(JSON.parse(data)));
    });
    res.on('end', function() {
      i++;
      loadDocs(i); // recurse
    });
  }
}

function done() {
  process.exit(0);
}


