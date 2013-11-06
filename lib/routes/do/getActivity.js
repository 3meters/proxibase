/*
 * getActivity
 */

var db = util.db

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  /* A set is defined by the combination of link type and target schema */
  var cursor = {
    fields: {
      linkTypes:    { type: 'array' },                                            // link types to include
      schemas:      { type: 'array' },                                            // schemas to include
      direction:    { type: 'string', default: 'in', value: 'in|out'},            // link direction entityId applies to
      sort:         { type: 'object', default: { modifiedDate: -1 }},             // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      where:        { type: 'object' },                                           // filter on link properties like _from
      limit:        { type: 'number', default: util.statics.optionsLimitDefault,  // applied per entity type
        validate: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax
          }
          return null
        },
      },
    }
  }

  var _body = {
    entityId:   { type: 'string', required: true },
    cursor:     { type: 'object', required: true, value: cursor.fields },
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.cursor.linkTypes && !req.body.cursor.schemas) {
    return res.error(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var entityIds = []
  var more = false

  doActivity()

  function doActivity() {
    log('doActivity')

    var query = { _from: req.body.entityId }

    if (req.body.cursor.schemas) {
      query.toSchema = { $in: req.body.cursor.schemas }
    }

    if (req.body.cursor.linkTypes) {
      query.type = { $in: req.body.cursor.linkTypes }
    }

    if (req.body.cursor.where) {
      query = { $and: [query, req.body.cursor.where] }
    }

    db.links
      .find(query, { _from: true, _to: true, type: true, modifiedDate: true })
      .sort(req.body.cursor.sort)
      .skip(req.body.cursor.skip)
      .limit(req.body.cursor.limit + (req.body.cursor.limit === 0 ? 0 : 1))
      .toArray(function(err, links) {

      if (err) return res.error(err)

      if (links.length > req.body.cursor.limit) {
        links.pop()
        more = true
      }

      for (var i = 0; i < links.length; i++){
        entityIds.push(links[i]._to)
      }
      getActions()
    })
  }

  function getActions() {
    log('getActions')
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

      var entityMap = {}
      var query = { _target: { $in: entityIds }}

      db.actions.find(query).toArray(function(err, actions) {
        if (err) return res.error(err)

        for (var i = 0; i < actions.length; i++){
          entityMap[actions[i]._target] = actions[i]._target
        }

        entityIds = []
        for (var propertyName in entityMap) {
          entityIds.push(entityMap[propertyName])
        }

        res.send({
          data: entityIds,
          date: util.getTimeUTC(),
          count: entityIds.length,
          more: more
        })
      })
    }
  }
}
