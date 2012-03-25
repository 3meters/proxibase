/*
 * Provide shared data constants for tests and tools
 */

var
  _ = require('underscore'),            // for cloning objects
  timeStamp = '.010101.00000.555.',     // jan 1 2000 + 555 miliseconds
  timeStampMs = new Date(2001, 0, 1, 0, 0, 0, 555).getTime()   // same but in milliseconds
  jid = '0000' + timeStamp + '000001',  // Jay is the prime user
  tableIds = {
    users: 0,
    links: 1,
    entities: 2,
    beacons: 3,
    documents: 5,
    observations: 7
  },
  defaultRecord = {}


// add system properties
function addSystemFields(record) {
  record._owner = jid
  record._creator = jid
  record._modifier = jid
  record.createdDate = timeStampMs
  record.modifiedDate = timeStampMs
}

defaultRecord.users = {
  _id: jid,
  name: 'Jay Gecko',
  email: 'jay@3meters.com',
  location: 'Seattle, WA',
  isDeveloper: true
}


defaultRecord.beacons = {
  _id: '0003.00:00:00:55:00:01',
  ssid: 'Default Beacon',
  beaconType: 'fixed',
  latitude: 47.659052376993834,     // jays house for now
  longitude: -122.659052376993834,
  visibility: 'public'
}


defaultRecord.entities = {
  _id: '0002' + timeStamp + '00001',
  imagePreviewUri: 'https://s3.amazonaws.com/3meters_images/default_entity_preview.jpg',
  imageUri: 'https://s3.amazonaws.com/3meters_images/default_entity.jpg',
  label: 'Default Entitiy',
  title: 'Default Entitiy',
  signalFence: -100,
  type: 'com.proxibase.aircandi.candi.picture',
  comments: [ ],
  visibility: 'public',
  enabled: true,
  locked: false,
  linkJavascriptEnabled: false,
  linkZoom: false,
  root: root
}

for (tableName in defaultRecord) {
  addSystemFields(defaultRecord[tableName])
}

// remeber to clone any exported objects
exports.jid = jid
exports.timeStamp = timeStamp
exports.timeStampMs = timeStampMs
exports.tableIds = _.clone(tableIds)
exports.getDefaultRecord = function(tableName) {
  assert(defaultRecord[tableName], 'No default record for ' + tableName)
  return _.clone(defaultRecord[tableName])
}


