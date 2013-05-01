/*
 * getEntitiesForUser
 */

var db = util.db
var getEntities = require('./getEntities').run

exports.main = function(req, res) {
  var options = {
        limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
        children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
        comments:{limit:util.statics.optionsLimitDefault, skip:0}
      }

  // request body template
  var _body = {
    userId:       {type: 'string', required: true},
    eagerLoad:    {type: 'object', default: { children:false, comments:false }},
    fields:       {type: 'object', default: {}},
    options:      {type: 'object', default: options},
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.options.children) {
    req.body.options.children = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.comments) {
    req.body.options.comments = {limit:util.statics.optionsLimitDefault, skip:0}
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.limit exceeded'))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.children.limit exceeded'))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.comments.limit exceeded'))
  }

  doEntitiesForUser(req, res)
}

function doEntitiesForUser(req, res) {
  var more = false

  db.entities
    .find({ _owner:req.body.userId, enabled:true }, { _id:true })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entitiesTracked) {

    if (err) return res.error(err)

    if (entitiesTracked.length > req.body.options.limit) {
      entitiesTracked.pop()
      more = true
    }

    if (entitiesTracked.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      var filteredIds = []  
      for (var i = entitiesTracked.length; i--;) {
        filteredIds.push(entitiesTracked[i]._id)
      }

      /* Build and return the entity objects. */
      getEntities(req, {
        entityIds: filteredIds,
        eagerLoad: req.body.eagerLoad,
        beaconIds: null,
        fields: req.body.fields,
        options: req.body.options
        }
        , function(err, entities) {
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
