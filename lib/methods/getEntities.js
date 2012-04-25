/*
 * getEntities
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  options = { limit:50, skip:0, sort:{modifiedDate:-1} },
  limitMax = 1000

exports.main = function(req, res) {
  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.entityIds && req.body.entityIds instanceof Array)) {
    return res.sendErr(new Error('entityIds[] is required'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return res.sendErr(new Error('entityIds[] must contain strings'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.sendErr(new Error("eagerLoad must be object type"))
  }

  if (req.body.fields && typeof req.body.fields !== 'object') {
    return res.sendErr(new Error("fields must be object type"))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.sendErr(new Error("options must be object type"))
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

  if (req.body.options.limit >= limitMax) {
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.skip >= req.body.options.limit) {
    return res.sendErr(new Error("options.skip must be less than options.limit"))
  }
  
  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, req.body.fields, req.body.options, false, res)
}
