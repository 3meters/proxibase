
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

var http = require('http');
var util = require('util');

var candi = {};

function getCandi(cb) {

  var options = {
    host: "dev.aircandi.com",
    path: "/airodata.svc/Entities",
    headers:  {"Accept": "application/json"},
  }

  http.get(options, onRes)
    .on('error', function(err) { throw err });

  function onRes(res) {
    var json = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) { json += chunk });
    res.on('end', function() {
      candi = JSON.parse(json);
      console.log("candi:\n" + util.inspect(candi));
      return cb();
    });
  }
}

function done() {
  console.log('finished');
  process.exit(0);
}

getCandi(done);

