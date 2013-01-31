/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */

var util = require('util')
var db = util.db
var data = require('../data')  
var log = util.log
var sreq = util.request // service request (non-aircandi)
var _ = require('underscore')

/*
 * Statics
 */
module.exports.statics = {
  typePicture: 'com.aircandi.candi.picture',
  typePlace: 'com.aircandi.candi.place',
  typePost: 'com.aircandi.candi.post',
  typeLink: 'com.aircandi.candi.link',
  typeFolder: 'com.aircandi.candi.folder'
}

var haversine = module.exports.haversine = function(lat1, lng1, lat2, lng2) {
  var R = 6371; // radius of earth = 6371km at equator

  // calculate delta in radians for latitudes and longitudes
  var dLat = (lat2-lat1) * Math.PI / 180;
  var dLng = (lng2-lng1) * Math.PI / 180;

  // get the radians for lat1 and lat2
  var lat1rad = lat1 * Math.PI / 180;
  var lat2rad = lat2 * Math.PI / 180;

  // calculate the distance d
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.sin(dLng/2) * Math.sin(dLng/2) * 
          Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d;
}

var logAction = module.exports.logAction = function logAction(target, targetSource, type, userId, data, req) {
  /*
   * Save action, returns immediately and any error is logged
   */
  var action = {
    _target: target,
    targetSource: targetSource,
    type: type,
    _user: userId,
    data: data
  }
  var options = {
    asAdmin: true,
    user: util.adminUser
  }
  db.actions.safeInsert(action, options, function (err, savedDoc) {
    if (err) util.logErr('Error inserting action', err)
  })
}

/*
 * Handles insert and update cases. If inserting an entity, any links to beacons
 * and parent entities must already exist or we won't be able to find them.
 * Because of special requirements, delete cases are handled in the delete logic.
 */

var propogateActivityDate = module.exports.propogateActivityDate = function(entityId, activityDate) {
  /*
   * We need to traverse all links from this entity to
   * beacons or other entities and update their activityDate.
   */
  db.links.find({ _from:entityId }).toArray(function(err, links) {
    if (err) {
      util.logErr('Find failed in propogateActivityDate', err)
      return
    }

    for (var i = links.length; i--;) {
      var tableName = links[i].toCollectionId == 2 ? 'entities' : 'beacons'
       db.collection(tableName).findOne({ _id: links[i]._to }, function (err, doc) {
        if (err) {
          util.logErr('Find failed in propogateActivityDate', err)
          return
        }

        if (doc) {
          /* 
           * We don't update activityDate if last update was less than activityDateWindow 
           */
          if (!doc.activityDate || (doc.activityDate && (activityDate - doc.activityDate > util.statics.activityDateWindow))) {
            doc.activityDate = activityDate 
            db.collection(tableName).update({_id:doc._id}, doc, {safe:true}, function(err) {
              if (err) {
                util.logErr('Update failed in propogateActivityDate', err)
                return
              }
              log('Updated activityDate for ' + tableName + ': ' + doc._id)
            })
            if (tableName == 'entities') {
              propogateActivityDate(doc._id, activityDate) // recurse
            }
          }
        }
      })
    }
  })
}
