/*
 * getEntities
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods')

exports.main = function(req, res) {
  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.entityIds && req.body.entityIds instanceof Array)) {
    return res.sendErr(new Error('request.body.entityIds[] is required'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return res.sendErr(new Error('requested.body.entityIds[] must contain strings'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("request.body.eagerLoad must be object type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }
  
  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, null, res)
}
