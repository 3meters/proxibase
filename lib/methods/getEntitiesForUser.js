/*
/*
 * getEntitiesForUser
 */

var
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),
  methods = require('./methods'),
  options = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}, 
    children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}},
  limitMax = 1000,
  more,
  req,
  res  

exports.main = function(request, response) {
  req = request
  res = response
  more = false

  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.sendErr(new Error("request.body.userId of type string is required"))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("request.body.eagerLoad must be object type"))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.sendErr(new Error("options must be object type"))
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

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.children.limit exceeded"))
  }

  doEntitiesForUser(req.body.userId)
}

function doEntitiesForUser(userId) {
  var query = { _creator:userId, enabled:true, root:true }
  db.collection('entities')
    .find(query, { _id:true })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, entities) {

    if (err) return res.sendErr(err)

    if (entities.length > req.body.options.limit) {
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
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, req.body.eagerLoad, null, null, req.body.options, more, res)
    }
  })
}
