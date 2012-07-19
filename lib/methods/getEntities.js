/*
 * getEntities
 */

var
  db = require('../main').db,
  log = require('../util').log,
  util = require('../util'),
  methods = require('./methods'),
  options = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}, 
    children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
    parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
    comments:{limit:util.statics.optionsLimitDefault, skip:0}
  }

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

  if (!req.body.eagerLoad) {
    req.body.eagerLoad = {children:false,comments:false,parents:false}
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

  if (!req.body.options.parents) {
    req.body.options.parents = {limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}}
  }

  if (!req.body.options.comments) {
    req.body.options.comments = {limit:util.statics.optionsLimitDefault, skip:0}
  }

  if (req.body.options.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.limit exceeded"))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.children.limit exceeded"))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.parents.limit exceeded"))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.sendErr(new Error("Maximum for options.comments.limit exceeded"))
  }

  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, null, req.body.fields, req.body.options, false, res)
}
