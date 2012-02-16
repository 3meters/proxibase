
var http = require('http');
var https = require('https');
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
var mid = '0000.000000.00000.000.000003';  // max
var did = '0000.000000.00000.000.000004';  // darren

var candi = [];
var entities = [];
var drops = [];

// start it
getCandi();

function getCandi() {

  var options = {
    host: "dev.aircandi.com",
    path: "/airodata.svc/Users",
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
      return processUsers();
    });
  }
}

function processUsers() {
  var users = [];
  for (var i = 0; i < candi.length; i++) {
    var c = candi[i];
    var u =  {};
    if (c.Id === 1001) u._id = jid;
    if (c.Id === 1002) u._id = gid;
    if (c.Id === 1003) u._id = aid;
    if (c.Id === 1013) u._id = mid;
    if (c.Id === 1014) u._id = did;
    u._owner = u._creator = u._modifier = jid;
    if (c.Name) u.name = c.Name;
    if (c.Email) u.email = c.Email; if (u._id === mid) u.email = "max@3meters.com";
    if (c.Role) u.role = c.Role;
    if (c.Password) u.password = c.Password;
    if (c.ImageUri) u.imageUri = c.ImageUri;
    if (c.LinkUri) u.linkUri = c.LinkUri;
    if (c.Location) u.location = c.Location;
    if (c.FacebookId) u.facebookId = c.FacebookId;
    if (c.IsDeveloper) u.isDeveloper = c.IsDeveloper;
    if (c.CreatedDate) u.createdDate = c.CreatedDate;
    if (c.ModifiedDate) u.modifiedDate = c.ModifiedDate;

    users.push(u);
  }
  console.dir(users);
  fs.writeFileSync('users.json', JSON.stringify(users));
}


function processBeacons() {
  var newBeacons = [];
  for (var i = 0; i < candi.length; i++) {
    var c = candi[i];
    var b =  {};
    b._owner = b._creator = b.modifier = jid;
    b.name = c.Id;
    for (var j = 0; j < beacons.length; j++) {
      if (c.Id === beacons[j].Id) {
        b._id = beacons[j]._id;
        j = beacons.length;
      }
    }
    if (c.Ssid) b.ssid = c.Ssid;
    if (c.Label) b.label = c.Label;
    if (c.BeaconSet) b._beaconSet = c.BeaconSet;
    if (c.Locked) b.locked = c.Locked;
    if (c.Visibility) b.visibility = c.Visibility;
    if (c.BeaconType) b.beaconType = c.BeaconType;
    if (c.Latitude) b.latitude  = c.Latitude;
    if (c.Longitude) b.longitude = c.Longitude;
    if (c.Altitude) b.altitude = c.Altitude;
    if (c.Accuracy) b.accuracy = c.Accuracy;
    if (c.Bearing) b.bearing = c.Bearing;
    if (c.Speed) b.speed = c.Speed;
    if (c.CreatedDate) b.createdDate = c.CreatedDate;
    if (c.ModifiedDate) b.modifiedDate = c.ModifiedDate;
    
    newBeacons.push(b);
  }
  console.dir(newBeacons);
  fs.writeFileSync('beacons.json', JSON.stringify(newBeacons));
}


function splitCandi(cb) {
  // generate new _ids
  for (var i = 0; i < candi.length; i++) {
    candi[i]._id = genId(2, candi[i].CreatedDate * 1000, candi[i].Id);
    // console.log("_id: " + candi[i]._id + " Id: " + candi[i].Id + " Parent: " + candi[i].Parent);
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
      candi[i]._beacon = beacons[0]._id;  // magic unknown beacon
    //console.log("_id: " + candi[i]._id + " BeaconId: " + candi[i].BeaconId + " _beacon: " + candi[i]._beacon);
  }

  // make new properties and delete old ones
  var c = candi;  // candi, entities, drops
  for (var i = 0; i < candi.length; i++) {
    var e = {}, d = {}, c = candi[i];
    
    // unused fields
    delete c.__metadata;
    delete c.Uri;
    delete c.Children;

    // set the user fields
    var id = jid;  // default to Jay
    if (!c.Creator) id = aid;
    if (c.Creator === 1000) id = aid;
    if (c.Creator === 1002) id = gid;
    if (c.Creator === 1013) id = mid;
    if (c.Creator === 1014) id = did;

    // if (c.Creator != 1001 && c.Creator != 1002) console.log(c.Creator + ' ' + id);

    // shared fields
    e._id = candi[i]._id; d._entity = c._id;
    e.modifier = e.creator = e.owner = d.creator = d.modifier = d.owner = id;
    e.createdDate = d.createdDate = c.CreatedDate * 1000;
    e.modifiedDate = d.modifiedDate = c.ModifiedDate * 1000;

    // entitity fields
    if (c._parent) e._parent = c._parent;
    e.type = c.Type;
    if (c.Label) e.name = c.Label;
    if (c.Label) e.label = c.Label;
    if (c.Title) e.title = c.Title;
    if (c.Subtitle) e.subtitle = c.Subtitle;
    if (c.Description) e.description = c.Description;
    if (c.ImageUri) e.imageUri = c.ImageUri;
    if (c.ImagePreviewUri) e.imagePreviewUri = c.ImagePreviewUri;
    if (c.LinkUri) e.linkUri = c.LinkUri;
    if (c.LinkZoom != null) e.linkZoom = c.LinkZoom;
    if (c.LinkJavascriptEnabled != null) e.linkJavascriptEnabled = c.LinkJavascriptEnabled;
    if (c.SignalFence != null) e.signalFence = c.SignalFence; 
    if (c.Visibility != null) e.visibility = c.Visibility;
    if (c.Enabled != null) e.enabled = c.Enabled;
    if (c.Locked != null) e.locked = c.Locked;

    // drop fields
    if (c._beacon) d._beacon = c._beacon;
    if (c.Latitude) d.latitude = c.Latitude;
    if (c.Longitude) d.longitude = c.Longitude;
    if (c.Longitude) d.altitude = c.Longitude;
    if (c.Bearing != null) d.bearing = c.Bearing;
    if (c.Speed != null) d.speed = c.Speed;
    if (c.Accuracy != null) d.accuracy = c.Accuracy;

    // console.log('id:' + e._id + '\n' + util.inspect(d, false, 5) + "\n");
    entities[i] = e;
    drops[i] = d;

  }

  fs.writeFileSync('entities.json', JSON.stringify(entities));
  fs.writeFileSync('drops.json', JSON.stringify(drops));
  done();

}



function done() {
  console.log('finished');
  process.exit(0);
}


