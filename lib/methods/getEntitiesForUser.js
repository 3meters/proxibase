/*
 * getEntitiesForUser
 */

var
  db = require('../main').db,
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  getEntities = require('./getEntities').main,
  limit = 1000,
  more = false  

exports.main = function(req, res) {
  if (!(req.body 
    && req.body.userId
    && typeof req.body.userId === 'string')) {
    return sendErr(res, new Error("request.body.userId of type string is required"))
  }
  more = false
  module.req = req
  module.res = res  
  req.userId = req.body.userId
  doEntitiesForUser(req.userId)
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
      if (entities.length > limit) {
        links.pop()
        more = true
      }
      var filteredIds = []  
      for (var i = entities.length; i--;) {
        filteredIds.push(entities[i]._id)
      }
      if (more) module.req.body.more = more
      module.req.body.entityIds = filteredIds
      return getEntities(module.req, module.res)
    }
  })
}