/*
 * getWatchedForUser
 */

var db = util.db
var getEntities = require('./getEntities').run
var getUsers = require('./getUsers').run

exports.main = function(req, res) {
  var options = {
        limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
        children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
        comments:{limit:util.statics.optionsLimitDefault, skip:0}
      }

  // request body template
  var _body = {
    userId:         {type: 'string', required: true},
    collectionId:   {type: 'string', required: true},
    eagerLoad:      {type: 'object', default: { children:false, comments:false }},
    fields:         {type: 'object', default: {}},
    options:        {type: 'object', default: options},
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

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

  doWatchedForUser(req, res)
}

function doWatchedForUser(req, res) {
  var more = false

  db.links
    .find({ _from:req.body.userId, toCollectionId:req.body.collectionId, type:'watch' })
    .sort(req.body.options.sort)
    .skip(req.body.options.skip)
    .limit(req.body.options.limit + 1)
    .toArray(function(err, links) {

    if (err) return res.error(err)

    if (links.length > req.body.options.limit) {
      links.pop()
      more = true
    }

    if (links.length == 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {

      var watchedIds = []
      for (var i = links.length; i--;) {
        watchedIds.push(links[i]._to)
      }

      if (req.body.collectionId == util.statics.collectionIds.entities) {

        /* Build and return the entity objects. */
        getEntities(req, {
          entityIds: watchedIds,
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
      else if (req.body.collectionId == util.statics.collectionIds.users) {

        /* Build and return the user objects. */
        getUsers(req, { userIds: watchedIds }, function(err, users) {
            if (err) return res.error(err)
            res.send({
              data: users,
              date: util.getTimeUTC(),
              count: users.length,
              more: more
            })
        })
      }
    }
  })
}