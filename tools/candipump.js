
var http = require('http');
var util = require('util');
var genId = require('./genids');
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

var beacons = [
  { Id: '00:00:00:00:00:00',
    Ssid: 'Undefined',
    _id: '0001.000000.00000.000.000000' },
  { Id: '00:1c:b3:ae:bf:f0',
    Ssid: 'Massena Upper',
    _id: '0001.120101.00000.000.000001' },
  { Id: '48:5b:39:e6:d3:55',
    Ssid: 'Ripple2',
    _id: '0001.120101.00000.000.000002' },
  { Id: '00:1c:b3:ae:bb:57',
    Ssid: 'Massena Lower',
    _id: '0001.120101.00000.000.000003' },
  { Id: '48:5b:39:e6:d9:7d',
    Ssid: 'Ripple1',
    _id: '0001.120101.00000.000.000004' },
  { Id: '48:5b:39:e6:d3:55',
    Ssid: 'Ripple2',
    _id: '0001.120101.00000.000.000005' },
  { Id: '00:12:0e:c2:42:fc',
    Ssid: 'Ripple3',
    _id: '0001.120101.00000.000.000006' },
  { Id: '48:5b:39:e6:db:30',
    Ssid: 'Ripple4',
    _id: '0001.120101.00000.000.000007' }
]

var aid = '0000.000000.00000.000.000000';  // annonymous user
var jid = '0000.000000.00000.000.000001';  // jay
var gid = '0000.000000.00000.000.000002';  // george

var candi = [];
var entities = [];
var drops = [];

// start it
getCandi();

function getCandi() {

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
      var candiObj = JSON.parse(json);
      candi = candiObj.d; // pull array to outer object
      // console.log("candi:\n" + util.inspect(candi, false, 5));
      console.log("Total candi: " + candi.length);
      return splitCandi();
    });
  }
}

function splitCandi(cb) {
  // generate new _ids
  for (var i = 0; i < candi.length; i++) {
    candi[i]._id = genId(2, candi[i].CreatedDate * 1000, candi[i].Id);
    console.log("_id: " + candi[i]._id + " Id: " + candi[i].Id + " Parent: " + candi[i].Parent);
  }
  // hook up _parent
  for (var i = 0; i < candi.length; i++) {
    if (candi[i].Parent) {
      for (var j = 0; j < candi.length; j++) {
        if (candi[i].Parent === candi[j].Id) {
          candi[i]._parent = candi[j]._id;
          j = candi.length; // break loop
        }
      }
    }
    //console.log("_id: " + candi[i]._id + " Id: " + candi[i].Id + " Parent: " + candi[i].Parent + " _par: " + candi[i]._parent);
  }
  // hook up _beacon
  for (var i = 0; i < candi.length; i++) {
    if (candi[i].BeaconId) {
      for (var j = 0; j < beacons.length; j++) {
        if (candi[i].BeaconId === beacons[j].Id) {
          candi[i]._beacon = beacons[j]._id;
          j = beacons.length; // break loop
        }
      }
    }
    if (!candi[i]._beacon) 
      candi[i]._beacon = beacons[0]._id;  // majic lost beacon
    //console.log("_id: " + candi[i]._id + " BeaconId: " + candi[i].BeaconId + " _beacon: " + candi[i]._beacon);
  }

  // make new properties and delete old ones
  var c = candi;  // candi, entities, drops
  for (var i = 0; i < candi.length; i++) {
    var e = {}, d = {}, c = candi[i];
    delete c.__metadata;
    delete c.Uri;
    e._id = candi[i]._id; d._entity = c._id; delete c._id; delete c.Id;
    e._parent = c._parent; delete c._parent; delete c.Parent;
    e.name = c.Label; e.title = c.Title != c.Label ? c.Title : undefined; delete c.Title; delete c.Label;
    e.subtitle = c.Subtitle || undefined; delete c.Subtitle;
    e.description = c.Description || undefined; delete c.Description;
    e.imageUri = c.ImageUri || undefined; delete c.ImageUri;
    e.imagePreviewUri = c.ImagePreviewUri || undefined; delete c.ImagePreviewUri;
    e.linkUri = c.LinkUri || undefined; delete c.LinkUri;
    e.linkZoom = c.LinkZoom || undefined; delete c.LinkZoom;
    e.LinkJavascriptEnabled = c.LinkJavascriptEnabled || undefined; delete c.LinkJavascriptEnabled;


    // console.log('subtitle ' + c.Subtitle);
    // console.log('id:' + e._id + ' c: ' + util.inspect(c, false, 5) + "\n");

  }

}

function done() {
  console.log('finished');
  process.exit(0);
}


