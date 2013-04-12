/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */

var db = util.db
var gcm = require('node-gcm')

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

// Return the distance between two points on the earth in meters
var haversine = module.exports.haversine = function(lat1, lng1, lat2, lng2) {
  var R = 6371000; // radius of earth = 6371km at equator

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

exports.logAction = function (action, cb) {

  if (type.isUndefined(cb)) cb = util.noop // callback is optional

  var _action = {
    _target:      {type: 'string', required: true},
    targetSource: {type: 'string', required: true},
    type:         {type: 'string', required: true},
    _user:        {type: 'string', required: true},
    data:         {type: 'object'},
  }

  var err = util.check(action, _action, {strict: true})
  if (err) {
    logErr('BUG: invalid call to logAction: ', err.stack || err)
    return cb(perr.serverError(err.message))
  }

  var options = {
    asAdmin: true,
    user: util.adminUser
  }

  db.actions.safeInsert(action, options, function (err, savedAction) {
    if (err) {
      util.logErr('Error inserting action', err)
      return cb(err)
    }
    cb(null, savedAction)
  })
}

exports.sendNotifications = function (notification, registrationIds) {

  var sendRetries = 4
  var sender = new gcm.Sender('AIzaSyBepUJ07Gq8ZeRFE9kAWH-8fwLpl7X0mpw')
  var gcmMessage = new gcm.Message()
  gcmMessage.addData('notification', JSON.stringify(notification))

  sender.send(gcmMessage, registrationIds, sendRetries, function (err, result) {
    if (err) {
      util.logErr('Error sending gcm message', err)
      return
    }
    log(result)
  });  
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
