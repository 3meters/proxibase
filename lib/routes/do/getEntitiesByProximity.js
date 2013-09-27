/*
 * getEntitiesByProximity
 */

var db = util.db
var async = require('async')
var getEntities = require('./getEntities').run

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var link = {
    fields: {    
      type:       { type: 'string', required: true },                                            
      schema:     { type: 'string', required: true },                                            
      links:      { type: 'boolean', default: false },
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      where:      { type: 'object' },                                             // filter on link properties like _from
      direction:  { type: 'string', default: 'both' },
      inactive:   { type: 'boolean', default: false },                            // include inactive links, inactive links never included in counts
      limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax
          }
          return null
        },
      },
    }
  }
  var cursor = {
    fields: {    
      sort:         { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      limit:        { type: 'number', default: util.statics.optionsLimitDefault,   // applied per entity type
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax
          }
          return null
        },
      },
    }
  }
  var _body = {
    beaconIds:      { type: 'array', required: true },                    // array of strings
    cursor:         { type: 'object', value: cursor.fields, default: { sort: { modifiedDate: -1 }, skip: 0, limit: util.statics.optionsLimitDefault }},
    links:          { type: 'object', default: { sort: { modifiedDate: -1 }}, value: {
      shortcuts:      { type: 'boolean', default: true },
      loadSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      loadWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects    
      active:         { type: 'array', value: link.fields },
    }},
    registrationId: { type: 'string' },
}
  
  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)
  var entityMap = {}
  var entityIds = []
  var more = false

  updateDevice()

  /*
   * If the query is for beacon entities then it is a good opportunity to
   * update the beacon array that is currently associated with the device. 
   * The beacon array is used to determine 'nearby" for notifications.
   * If a registrationId is passed, we assume the entity ids are for beacon entities.
   */
  function updateDevice() {
    if (!req.body.registrationId) {
      doEntitiesByProximity()
    }
    else {
      log('Updating beacons associated with device')
      db.devices.findOne({ registrationId: req.body.registrationId }, function(err, doc) {
        if (err) return res.error(err)
        /* 
         * An unregistered/invalid registrationId isn't great but shouldn't prevent
         * the call from proceeding 
         */
        if (!doc) return doEntitiesByProximity()

        doc.beacons = req.body.beaconIds
        doc.beaconsDate = util.getTime()

        var options = {
          asAdmin: true,
          user: util.adminUser
        }

        db.devices.safeUpdate(doc, options, function(err, updatedDoc) {
          if (err) return res.error(err)
          if (!updatedDoc) return res.error(perr.notFound())
          doEntitiesByProximity()
        })
      })
    }
  }

  function doEntitiesByProximity() {
    log('doEntitiesByProximity')

    var query = { _to: { $in: req.body.beaconIds }, type: util.statics.typeProximity }
    
    db.links
      .find(query, { _from:true })
      .sort(req.body.cursor.sort)
      .skip(req.body.cursor.skip)
      .limit(req.body.cursor.limit + 1)
      .toArray(function(err, links) {

      if (err) return res.error(err)

      if (links.length > req.body.cursor.limit) {
        links.pop()
        more = true
      }

      for (var i = links.length; i--;) {
        entityMap[links[i]._from] = links[i]._from
      }

      for (var propertyName in entityMap) {
        entityIds.push(entityMap[propertyName])
      }

      doGetEntities()
    })
  }

  function doGetEntities() {
    log('doGetEntities')
    /* Build and return the entity objects. */
    if (entityIds.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      var options = util.clone(req.body)
      options.entityIds = entityIds
      getEntities(req, options, function(err, entities) {
          if (err) return res.error(err)
          res.send({
            data: entities,
            date: util.getTimeUTC(),
            count: entities.length,
            more: more
          })      
      })
    }
  }  
}
