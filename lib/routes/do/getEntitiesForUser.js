/*
 * getEntitiesForUser
 */

var db = util.db
var getEntities = require('./getEntities').run

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var activeLink = {
    fields: {    
      type:       { type: 'string', required: true },                                            
      links:      { type: 'boolean', default: false },
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
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
  var _body = {
    userId:         { type: 'string', required: true},
    where:          { type: 'object' },
    linkSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    linkWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects    
    activeLinks:    { type: 'array',  value: activeLink.fields },
  }
  
  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  doEntitiesForUser()

  function doEntitiesForUser() {
    log('doEntitiesForUser')
    var more = false
    var query = { _owner:req.body.userId, enabled:true }

    if (req.body.where) {
      query = { $and: [query, req.body.where] }
    }
    db.entities
      .find(query, { _id:true })
      .sort(req.body.linkSort)
      .limit(util.statics.optionsLimitDefault + 1)
      .toArray(function(err, entities) {

      if (err) return res.error(err)
      if (entities.length > util.statics.optionsLimitDefault) {
        entities.pop()
        more = true
      }

      if (entities.length == 0) {
        res.send({
          data: [],
          date: util.getTimeUTC(),
          count: 0,
          more: more
        })
      }
      else {
        var entityIds = []  
        for (var i = entities.length; i--;) {
          entityIds.push(entities[i]._id)
        }

        /* Build and return the entity objects. */
        var options = util.clone(req.body)
        options.entityIds = entityIds
        options.entityType = 'entities'
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
    })
  }
}
