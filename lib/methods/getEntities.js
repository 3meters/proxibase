/*
 * getEntities
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  sendErr = require('../util').sendErr

exports.main = function(req, res) {
  if (!req.body) {
    return sendErr(res, new Error("request.body is required"))
  }

  if (!(req.body.entityIds && req.body.entityIds instanceof Array)) {
    return sendErr(res, new Error('request.body.entityIds[] is required'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return sendErr(res, new Error('requested.body.entityIds[] must contain strings'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return sendErr(res, new Error("request.body.eagerLoad must be object type"))
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }
  
  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, res)
}