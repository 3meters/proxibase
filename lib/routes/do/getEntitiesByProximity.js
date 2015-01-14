/*
 * getEntitiesByProximity
 */

var getEntities = require('./getEntities').run
var methods = require('./methods')

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _link = {
    fields: {
      type:       { type: 'string', required: true },
      schema:     { type: 'string', required: true },
      links:      { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      where:      { type: 'object' },                                           // filter on link properties like _from
      direction:  { type: 'string', default: 'both', value: 'in|out|both' },
      limit:      { type: 'number', default: statics.db.limits.default,         // always the top n based on modifiedDate
        validate: function(v) {
          if (v > statics.db.limits.max) {
            return 'Max entity limit is ' + statics.db.limits.max
          }
          return null
        },
      },
    }
  }

  var cursor = {
    fields: {
      sort:         { type: 'object', default: { modifiedDate: -1 }},           // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      limit:        { type: 'number', default: statics.db.limits.default,       // applied per entity type
        validate: function(v) {
          if (v > statics.db.limits.max) {
            return 'Max entity limit is ' + statics.db.limits.max
          }
          return null
        },
      },
    }
  }

  var _body = {
    beaconIds:      { type: 'array' },                                          // array of strings
    cursor:         { type: 'object', value: cursor.fields, default: { sort: { modifiedDate: -1 }, skip: 0, limit: statics.db.limits.default }},
    links:          { type: 'object', value: {
      shortcuts:      { type: 'boolean', default: true },
      active:         { type: 'array', value: _link.fields },
    }},
    installId:      { type: 'string' },
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var entityMap = {}
  var entityIds = []

  /*
   * If beaconIds and installId are provided then it is a good opportunity to
   * update the beacon array that is currently associated with the install.
   * The beacon array is used to determine 'nearby" for notifications.
   */
  if (req.body.installId) {
    var params = {
      installId: req.body.installId,
      userId: req.dbOps.user._id,   // could be authenticated user or anonymous user
      beaconIds: req.body.beaconIds,
      log: true,
    }
    /*
     * We are not waiting for a callback so this could fail and we still complete the call.
     * Most common failure is because installId and/or userId are missing|invalid.
     */
    methods.updateInstall(params)
    doEntitiesByProximity()
  }

  function doEntitiesByProximity() {
    log('doEntitiesByProximity')
    if (!req.body.beaconIds) {
      doGetEntities()
    }
    else {
      var query = { _to: { $in: req.body.beaconIds }, type: statics.typeProximity }
      var ops = util.clone(req.dbOps)
      ops.fields = { _from:true }
      db.links.safeFind(query, ops, function(err, links) {

        if (err) return res.error(err)

        for (var i = links.length; i--;) {
          entityMap[links[i]._from] = links[i]._from
        }

        for (var propertyName in entityMap) {
          entityIds.push(entityMap[propertyName])
        }

        doGetEntities()
      })
    }
  }

  function doGetEntities() {
    log('doGetEntities')
    /* Build and return the entity objects. */
    if (entityIds.length === 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: false,
      })
    }
    else {
      var options = util.clone(req.body)
      options.entityIds = entityIds
      getEntities(req, options, function(err, entities, more) {
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

exports.main.anonOk = true
