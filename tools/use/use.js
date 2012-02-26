//
//
// utility for sending requests to proxibase
//
// usage:  node use.js cmdfile 
//     where cmdfile contains a json file overriding default properties
//
//     node use.js
//     will err out with the expected format of cmdfile
//
//


var util = require('util'); 
var https = require('https');

var cmd = {
  host: "api.localhost",
  port: "8043",
  method: "get",
  headers:  {"Content-Type": "application/json", "sessionToken": "root"},
  body: {"data": {}}
};

var usrCmd = {};
var args = process.argv;

// read from config.js unless aother command file is specified on the command line
if (args.length < 3)
  usrCmd = require('./config');
else 
  usrCmd = require('./' + args[2]);

// merge props from the command file over the default
for (var prop in usrCmd) {
  cmd[prop] = usrCmd[prop];
}


// recursively add new docs 
function addNextDoc(iDoc, cb) {
  while (iDoc--) {
    return sendRequest(function() {
      addNextDoc(iDoc, cb);
    });
  }
  return cb();
}

//
// send req based on module.cmd
//
function sendRequest(cb) {
  var req = https.request(cmd, onResponse);
  if ((cmd.method === 'post' || cmd.method ==='delete') && cmd.body) 
    req.write(JSON.stringify(cmd.body));
  req.end();
  req.on('error', function(err) {
    console.error('Unexpcted Error in sendRequest.');
    return cb(err);
  });
  function onResponse(res) {
    res.setEncoding('utf8');
    var json = '';
    res.on('data', function(chunk){
      json += chunk;
    });
    res.on('end', function(){
      if (json.length > 0) res.body = JSON.parse(json);
      printResponse(res, cb);
    });
  }
}


function printResponse(res, cb){
  console.log("\nStatusCode: " + res.statusCode);
  if (!res.body) return cb();
  console.log("\nRaw body:\n");
  console.log(JSON.stringify(res.body));
  if (res.body.message) {
    console.log("\nMessage: " + util.inspect(res.body.message, false, 8));
  }
  if (res.body.data) { 
    console.log("\nPretty Print of data (not valid JSON): \n");
    if (res.body.data.length) {
      var len = res.body.data.length;
      for (var i = 0; i < len; i++) {
        console.log(util.inspect(res.body.data[i], false, 8));
      }
    } else {
      console.log(util.inspect(res.body.data, false, 8));
    }
  }
  return cb();
}

function done(err) {
  if (err) throw err;
  console.log("\nuse finished ok\n");
  process.exit(0);
}

// run it
if (cmd.method === "post" && cmd.addDocs)
  addNextDoc(parseInt(cmd.addDocs), done); 
else
  sendRequest(done);
