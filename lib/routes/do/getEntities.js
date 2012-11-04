/*
 * getEntities
 */

var util = require('util')
  , db = util.db
  , log = util.log
  , methods = require('./methods')
  , options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }

exports.main = function(req, res) {
  if (!req.body) {
    return res.error(proxErr.missingParam('body: object'))
  }

  if (!(req.body.entityIds && req.body.entityIds instanceof Array)) {
    return res.error(proxErr.missingParam('entityIds: [string]'))
  }

  if (req.body.entityIds[0] && !(typeof req.body.entityIds[0] === 'string')) {
    return res.error(proxErr.badType('entityIds[0]: string'))
  }

  if (req.body.eagerLoad && typeof req.body.eagerLoad !== 'object') {
    return res.error(proxErr.missingParam('eagerLoad: object'))
  }

  if (req.body.fields && typeof req.body.fields !== 'object') {
    return res.error(proxErr.missingParam('fields: object'))
  }

  if (req.body.options && typeof req.body.options !== 'object') {
    return res.error(proxErr.missingParam('options: object'))
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
    return res.error(proxErr.badValue('Maximum for options.limit exceeded'))
  }

  if (req.body.options.children.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.children.limit exceeded'))
  }

  if (req.body.options.parents.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.parents.limit exceeded'))
  }

  if (req.body.options.comments.limit >= util.statics.optionsLimitMax) {
    return res.error(proxErr.badValue('Maximum for options.comments.limit exceeded'))
  }

  methods.getEntities(req.body.entityIds, req.body.eagerLoad, null, null, req.body.fields, req.body.options, false, req, res)
}
