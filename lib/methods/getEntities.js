/*
 * getEntities
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  options = { limit:50, skip:0, sort:{modifiedDate:-1} }

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

  if (req.body.fields && typeof req.body.fields !== 'object') {
    return res.sendErr(new Error("request.body.fields must be object type"))
  }

  if (!req.body.options) {
    req.body.options = options
  }

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false}
  }

  if (!req.body.fields) {
    req.body.fields = {}
  }
  
  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, req.body.fields, req.body.options, res)
}
