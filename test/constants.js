/*
 * Provide shared data constants for tests and tools
 */

var
  _ = require('underscore')
  tableMap = {
    users: {tableId:0, records:[]},
    links: {tableId:1, records:[]},
    entities: {tableId:2, records:[]},
    beacons: {tableId:3, records:[]},
    documents: {tableId:5, records:[]},
    observations: {tableId:7, records:[]}
  },
  timeStamp = '.010101.00000.555.',
  jid = '0000' + timeStamp + '000001',
  gid = '0000' + timeStamp + '000002'

tableMap.users.records.push({
  _id: jid,
  _owner: jid,
  _modifier: jid,
  name: 'Jay Gecko',
  email: 'jay@3meters.com',
  location: 'Seattle, WA',
  facebookId: 'george.snelling',
  pictureUri: 'https://s3.amazonaws.com/3meters_images/1001_20120211_103113.jpg',
  isDeveloper: true
})

tableMap.users.records.push({
  _id: gid,
  _owner: gid,
  _modifier: gid,
  name: 'George Snelling',
  email: 'george@3meters.com',
  location: 'Seattle, WA',
  facebookId: '696942623',
  pictureUri: 'https://graph.facebook.com/george.snelling/picture?type=large',
  isDeveloper: true
})

tableMap.beacons.records.push({
  _id: '0003.00:00:00:55:00:01',
  _owner: jid,
  _creator: jid,
  _modifier: jid,
  ssid: 'Default Beacon',
  beaconType: 'fixed',
  latitude: 47.659052376993834,     // jays house for now
  longitude: -122.659052376993834,
  visibility: 'public'
})

tableMap.entities.records.push({
  _id: '0002' + timeStamp + '00001',
  imagePreviewUri: 'https://s3.amazonaws.com/3meters_images/default_entity_preview.jpg',
  imageUri: 'https://s3.amazonaws.com/3meters_images/default_entity.jpg',
  label: 'Default Entitiy',
  signalFence: -100,
  title: 'Default Entitiy',
  type: 'com.proxibase.aircandi.candi.picture',
  comments: [ ],
  visibility: 'public',
  enabled: true,
  locked: false,
  linkJavascriptEnabled: false,
  linkZoom: false,
  root: root
})

exports.tableMap = _.clone(tableMap)  // hand out a safe copy
exports.timeStamp = timeStamp
exports.jid = jid
exports.gid = gid


