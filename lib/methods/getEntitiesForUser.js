/*
/*
 * getEntitiesForUser
 */

var
  db = require('../main').db,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  methods = require('./methods'),
  limit = 1000,
  more = false  

exports.main = function(req, res) {
  if (!req.body) {
    return sendErr(res, new Error("request.body is required"))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return sendErr(res, new Error("request.body.userId of type string is required"))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return sendErr(res, new Error("request.body.eagerLoad must be object type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }

  module.req = req
  module.res = res  

  doEntitiesForUser(req.body.userId)
}

function doEntitiesForUser(userId) {
  var query = {_creator:userId, enabled:true, root:true}
  db.collection('entities').find(query, {_id:true}).limit(limit + 1).toArray(function(err, entities) {

    if (err) return sendErr(module.res, err)
    if (entities.length == 0) {
      module.res.send({
        data: [],
        count: 0,
        more: more
      })
    }
    else {
      if (entities.length > limit) entities.pop()
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      methods.getEntities(filteredIds, module.req.body.eagerLoad, null, module.res)
    }
  })
}