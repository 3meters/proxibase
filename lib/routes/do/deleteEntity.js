/**
 * routes/do/deleteEntity.js
 *
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityId:               { type: 'string', required: true },
  skipActivityDate:       { type: 'boolean' },
  verbose:                { type: 'boolean' },
}

/* Request body template end =========================================== */

exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var options = util.clone(req.body)
  run(req, options, function(err, entityId, activityDate) {
      if (err) return res.error(err)
      res.send({
        info: 'Entity deleted',
        data: { _id: entityId },
        date: activityDate,
        count: 1,
      })
  })
}

/*
 * Internal method that can be called directly 
 *
 * No top level limiting is done in this method. It is assumed that the caller has already 
 * identified the desired set of entities and handled any limiting. 
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var activityDate = util.now()
  var err = util.check(options, _body)
  if (err) return cb(err)

  // set module vars
  var activityEntityIds = []
  var entityId = options.entityId
  var entityIdParsed = util.parseId(entityId)
  var adminModify = { user: req.user, asAdmin: true }
  var userModify =  req.user.developer ? adminModify : { user: req.user }
  var verbose = options.verbose

  doDeleteEntity()

  function doDeleteEntity() {

    db[entityIdParsed.collectionName].safeRemove({ _id: entityId }, userModify, function(err, meta) {
      if (err) return done(err)
      if (!meta.count) return cb(proxErr.notFound())
      deleteStrongLinkedEntities()
    })
  }

  /*
   *  Delete strong-linked entities
   */
  function deleteStrongLinkedEntities() {
    if (verbose) log('deleteStrongLinkedEntities for ', entityId)

    var query = _.extend(db.links.isStrongFilter(), {_to: entityId})

    db.links.find(query).toArray(function(err, links) {
      if (err) return done(err)
      if (links.length == 0) return done()

      /* Build collection of ids for entities that match the delete list */
      var deleteIds = []
      for (var i = links.length; i--;) {
        deleteIds.push(links[i]._from)
      }

      async.forEachSeries(deleteIds, deleteEntity, deleteLinksFrom)

      function deleteEntity(deleteId, next) {
        var deleteIdParsed = util.parseId(deleteId)
        db[deleteIdParsed.collectionName].safeRemove({ _id:deleteId }, adminModify, next)
      }

    })
  }

  function deleteLinksFrom(err) {
    if (err) return done(err)

    if (verbose) log('deleteLinksFrom: ' + entityId)

    db.links.find({ _from:entityId }).toArray(function(err, links) {
      if (err) return done(err)

      var n = util.now()
      async.forEachSeries(links, deleteLink, deleteLinksTo)
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, adminModify, next)
      }
    })
  }

  function deleteLinksTo(err) {
    if (err) return done(err)
    if (verbose) log('deleteLinksTo: ' + entityId)

    db.links.find({ _to:entityId }).toArray(function(err, links) {
      if (err) return done(err)

      async.forEachSeries(links, deleteLink, done)
      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, adminModify, next)
      }
    })
  }

  function done(err) {
    if (err) logErr(err.stack || err)
    cb(err, entityId, activityDate)
  }
}
