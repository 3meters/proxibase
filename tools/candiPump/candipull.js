/*
 * suck candi from dev.aircandi.com, transform it into data files that can be loaded into proxibase
 */

var http = require('http')
var genId = require('./genids')
var fs = require('fs')

var proxModels = {
  0: "users",
  1: "beacons",
  2: "entities",
  3: "drops",
  4: "comments",
  5: "documents",
  6: "beaconsets"
}

var candiModels = {
  0: "User",  // 5
  1: "BeaconSets",  // 2
  2: "Comments", // 21 
  3: "Documents", // 1
  4: "Beacons", // 6
  5: "Entities", // 78
  6: "EntityTypes" // 6 
}

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
    _id: '0001.120101.00000.000.000007' },
  { Id: '00:24:7b:a9:b5:fa',
    Ssid: 'myqwest2169',
    _id: '0001.120101.00000.000.000008' },
  { Id: '00:24:b2:5c:5b:71',
     Ssid: 'NetGEAR',
    _id: '0001.120101.00000.000.000009' }

]


var aid = '0000.000000.00000.000.000000'  // annonymous user
var jid = '0000.000000.00000.000.000001'  // jay
var gid = '0000.000000.00000.000.000002'  // george
var mid = '0000.120101.49595.648.383743'  // max
var did = '0000.120101.36563.345.675873'  // darren

var tables = [
  {name: "Users", fn: processUsers},
  {name: "Beacons", fn: processBeacons},
  {name: "Entities", fn: processEntities}
]

var candi = [];

// start it
getCandi(tables.length, done);

function getCandi(iTable, cb) {

  if (!iTable--) return cb(); // done, break recursion

  var options = {
    host: "dev.aircandi.com",
    path: "/airodata.svc/" + tables[iTable].name,
    headers:  {"Accept": "application/json"}
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
      return tables[iTable].fn(iTable, cb);
    });
  }
}

function processUsers(iTable, cb) {
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
  fs.writeFileSync('users.json', JSON.stringify(users));
  console.log(users.length + ' users');
  return getCandi(iTable, cb);
}


function processBeacons(iTable, cb) {
  var newBeacons = [];
  for (var i = 0; i < candi.length; i++) {
    var c = candi[i];
    var b =  {};
    b._owner = b._creator = b._modifier = jid;
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
  fs.writeFileSync('beacons.json', JSON.stringify(newBeacons));
  console.log(newBeacons.length + ' beacons');
  return getCandi(iTable, cb);
}


function processEntities(iTable, cb) {
  var entities = [];
  var drops = [];

  // generate new _ids
  for (var i = 0; i < candi.length; i++) {
    candi[i]._id = genId(2, candi[i].CreatedDate * 1000, candi[i].Id);
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
  }

  // make new properties and delete old ones
  var c = candi;  // candi, entities, drops
  for (var i = 0; i < candi.length; i++) {
    var e = {}, d = {}, c = candi[i];

    // set the user fields
    var id = jid;  // default to Jay
    if (!c.Creator) id = aid;
    if (c.Creator === 1000) id = aid;
    if (c.Creator === 1002) id = gid;
    if (c.Creator === 1013) id = mid;
    if (c.Creator === 1014) id = did;

    // shared fields
    e._id = candi[i]._id; d._entity = c._id;
    e._modifier = e._creator = e._owner = d._creator = d._modifier = d._owner = id;
    e.createdDate = d.createdDate = c.CreatedDate * 1000;
    e.modifiedDate = d.modifiedDate = c.ModifiedDate * 1000;

    // entitity fields
    if (c._parent) e._parent = c._parent;
    e.type = c.Type;
    if (c.name) e.name = c.name;
    if (c.Subtitle) e.subtitle = c.Subtitle;
    if (c.Description) e.description = c.Description;
    if (c.Photo) e.photo = c.Photo;
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

    entities[i] = e;
    drops[i] = d;
  }

  fs.writeFileSync('entities.json', JSON.stringify(entities));
  fs.writeFileSync('drops.json', JSON.stringify(drops));
  console.log(entities.length + ' entities');
  console.log(drops.length + ' drops');
  return getCandi(iTable, cb);

}

function done() {
  console.log('finished');
  process.exit(0);
}


