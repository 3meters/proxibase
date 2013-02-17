/*
/*
 * getEntitiesForUser
 */

var db = util.db
var getEntities = require('./getEntities').run
var options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }
var limitMax = 1000
var more
var req
var res


exports.main = function(request, response) {
  //TODO:  The following is a bug!
  req = request
  res = response
  more = false

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.error(proxErr.missingParam('userId type string'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.error(proxErr.missingParam('eagerLoad type object'))
  }

  if (req.body.filter && typeof req.body.filter !== 'string') {
    return res.error(proxErr.missingParam('filter type string'))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.error(proxErr.missingParam('options type object'))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }

  if (!req.body.fields) {
    req.body.fields = {}
  }

  if (!req.body.options) {
    req.body.options = options
  }

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

  doEntitiesForUser(req.body.userId)
}

function doEntitiesForUser(userId) {
  var query = { _owner:userId, enabled:true }
  if (req.body.filter) {
    query = { _owner:userId, enabled:true, namelc: { $regex: '^' + req.body.filter, $options: 'i'}}
  }

  db.entities
    .find(query, { _id:true })
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
