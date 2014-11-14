/**
 *  Links schema.  Properties and methods required for safeFind
 *    are included in _links.js.  Properties and methods here are
 *    for the proxibase service.
 */


var mongo = require('../mongosafe')
var base = require('./_base')
var linkBase = require('./_link')
var async = require('async')
var sLink = statics.schemas.link

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    type:         { type: 'string', required: 'true',
                      value: 'like|watch|proximity|create|content|share'},
    proximity:    { type: 'object', value: {
      primary:      { type: 'boolean' },
      signal:       { type: 'number' },
    }},
  },

  before: {
    insert: [canLinkFrom, canReadTo, canLinkTo, setProps],
    update: [checkUpdate],
    remove: [canRemove, removeActions, decrementStats],
  },

  after: {
    insert: after,
    update: after,
    remove: after,
  },

  methods: {
    isStrong: isStrong,
    isStrongFilter: isStrongFilter
  },

}


function canLinkFrom(doc, previous, options, next) {

  var docFrom = options.docFrom
  if (!docFrom) return next(perr.badValue(doc._from))

  // Admin
  if (options.asAdmin) return next()

  // User owns _from, the common case for the client
  if (options.user._id === docFrom._owner) return next()

  // We allow logged-in users to create proximity links
  // from patches they do not own
  if ((doc.type === 'proximity')
      && (doc.fromSchema === 'patch')
      && (doc.toSchema === 'beacon')
      && (options.user._id !== util.anonId)) {
    return next()
  }

  // Users can create links from applinks to public, admin-owned patches
  if ((doc.fromSchema === 'applink')
     && (doc.toSchema === 'patch')
     && options.docTo
     && (options.docTo._owner === util.adminId)
     && (!options.docTo.restricted)) {
    return next()
  }

  // Fail
  next(perr.badAuth('User ' + options.user._id +
      ' cannot create a link from ' + docFrom._id +
      ' owned by ' + docFrom._owner))
}


function canReadTo(link, previous, options, next) {

  var clTo = options.clTo

  // already set by _link.js becuase user has read perms directly
  if (options.docTo) return next()

  // safeFindOne will do an acl-based permission check
  db[clTo].safeFindOne({_id: link._to}, options, function(err, docTo, updatedOps) {
    if (err) return next(err)
    if (!docTo) return next(perr.badValue(link._to))
    options.docTo = docTo
    options.asReader = updatedOps.asReader
    next()
  })
}


function canLinkTo(doc, previous, options, next) {

  var docTo = options.docTo

  if (docTo.restricted && !options.asReader
      && (options.user._id !== docTo._owner)
      && (doc.type !== 'watch')) {   // means a request to watch, will be created disabled
    // options.clTo may be a public, yet restricted patch, look for explicity watch link
    db[options.clTo].userIsWatching(options.user._id, options.docTo, function(err, isWatching) {
      if (err) return next(err)
      if (isWatching) return next()
      return next(perr.badAuth('User ' + options.user._id +
          ' cannot create a link to ' + docTo._id))
    })
  }
  else next()
}


// If _to doc is a patch and user is not patch owner, set
// enabled to false.
function setProps(doc, previous, options, next) {

  var docTo = options.docTo
  var docFrom = options.docFrom

  doc._owner = docTo._owner // Changed 8/21/14
  doc._creator = docFrom._creator
  doc._modifier = docFrom._modifier

  if (!docTo.restricted) return next()
  if (doc.type !== 'watch') return next()
  if (docTo._owner === options.user._id) return next()

  // This is a reqested watch link. Allow it to be created in a disabled state.
  doc.enabled = false

  // Check for outstanding share invitations between the user and the restricted
  // _to entity.  This seems like it could be tightend up and made less confusing
  var shareLinkQuery = {
    _to: docTo._id,
    fromSchema: 'message',  // necessary?
    type: 'share',
  }

  db.links.safeFind(shareLinkQuery, options, function(err, shareMsgLinks) {
    if (err) return next(err)
    if (!shareMsgLinks.length) return next()

    async.eachSeries(shareMsgLinks, findLinkFromShareMsgToUser, next)

    function findLinkFromShareMsgToUser(shareMsgLink, nextLink) {

      var userShareLinkQry = {
        _to: options.user._id,
        _from: shareMsgLink._from,
        type: 'share',
      }

      db.links.safeFind(userShareLinkQry, options, function(err, invite) {
        if (err) return next(err)
        if (invite) {
          doc.enabled = true
          return next()  // break out of outer call
        }
        nextLink()
      })
    }
  })
}


// Users cannot change the link targets
function checkUpdate(doc, previous, options, next) {

  if (options.asAdmin) return next()
  if ((doc._from !== previous._from) || (doc._to !== previous._to)) {
    return next(perr.forbidden('You cannot update the _from or _to of link'))
  }
  return next()
}


// Owner of either the from or to doc can remove the link
function canRemove(doc, previous, options, next) {
  if (options.asAdmin) return next()
  var userId = options.user._id
  if (userId === doc._owner) return next()
  if (userId === options.docTo._owner) return next()
  if (userId === options.docFrom._owner) return next()
  return perr.badAuth('User ' + userId + ' cannot remove link', previous)
}


// We remove them so user can't create spam notifications by create/delete/create
function removeActions(doc, previous, options, next) {

  if (options.log) log('Removing actions for link', previous._id)
  this.db.actions.remove({_entity: previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

// Decrement stat counts when a link is removed, first checking to see whether
// it has been included in the stats calucations  This may not be worth the
// perf hit -- the alternative is to rebuild all the stats each night
// Note that due to unusual structure of the underlying table, we don't
// use the safe methods to perform the updates
function decrementStats(doc, previous, options, next) {

  var lastToStatQuery = {_id: 'do.lastLinkStat_to'}
  var lastFromStatQuery = {_id: 'do.lastLinkStat_from'}

  var toQuery = {
    '_id._to': doc._to,
    '_id.toSchema': doc.toSchema,
    '_id.fromSchema': doc.fromSchema,
    '_id.type': doc.type,
    '_id.day': doc._id.split('.')[1]
  }

  var fromQuery = {
    '_id._from': doc._from,
    '_id.toSchema': doc.toSchema,
    '_id.fromSchema': doc.fromSchema,
    '_id.type': doc.type,
    '_id.day': doc._id.split('.')[1]
  }

  decrementTos()

  function decrementTos() {

    // Only decrement the stats if this link was created before the stats were
    // last calculated
    db.documents.safeFindOne(lastToStatQuery, {asAdmin: true}, function(err, lastStat) {
      if (err) return fail(err, lastToStatQuery)
      if (!(lastStat && lastStat.data)) return decrementFroms()
      if (lastStat.data._link < doc._id) return decrementFroms()  // link was created after last calc

      db.tos.findOne(toQuery, function(err, doc) {
        if (err) return fail(err)
        if (!doc) return decrementFroms()
        if (tipe.isNumber(doc.value) && (doc.value >= 1)) {
          // mongoSafe does not play well with composite _ids, use regular update
          doc.value -= 1
          db.tos.update(toQuery, doc, function(err) {
            if (err) return fail(err, toQuery)
            decrementFroms()
          })
        }
        else {
          decrementFroms()
        }
      })
    })
  }

  function decrementFroms() {
    db.documents.safeFindOne(lastFromStatQuery, {asAdmin: true}, function(err, lastStat) {
      if (err) return fail(err, lastFromStatQuery)
      if (!(lastStat && lastStat.data)) return next()
      if (lastStat.data._link < doc._id) return next()

      db.froms.findOne(fromQuery, function(err, doc) {
        if (err) return fail(err)
        if (!doc) return next()
        if (tipe.isNumber(doc.value) && (doc.value >= 1)) {
          doc.value -= 1
          db.froms.update(fromQuery, doc, function(err) {
            if (err) return fail(err, fromQuery)
            next()
          })
        }
        else {
          next()
        }
      })
    })
  }

  function fail(err, query) {
    logErr('Non-fatal error updating link stats when deleting stats')
    logErr('Query:', query)
    logErr('Error:', err)
    next()
  }
}


// Called after write has been performed
function after(err, state, cb) {

  if (err) return finish(err)

  var db = this.db
  var link = state.document
  var options = state.options   // set by _links.js
  var docTo = options.docTo
  var meta = state.meta || {}

  if (!docTo) return logActions()  // many reasons this can be ok

  var schema = db.safeSchema(docTo.schema)
  if (!schema) return cb(perr.serverError('Unkown schema for docTo', docTo))

  if (!schema.fields.activityDate) return logActions()

  if (!isStrong(link, docTo)) return logActions()

  // Tickle activity date for linked-to entity
  var newActivityDate = util.now()
  if ('update' === state.method) newActivityDate = link.modifiedDate

  var activityDateWindow = (tipe.isDefined(options.activityDateWindow))
    ? options.activityDateWindow
    : statics.activityDateWindow

  if (docTo.activityDate && (docTo.activityDate + activityDateWindow > newActivityDate)) {
    return logActions()
  }

  var update = {
    _id: docTo._id,
    schema: schema.name,
    activityDate: newActivityDate
  }

  db[schema.collection].updateActivityDate(update, function(err) {
    if (err) {
      err.message = 'Warning, link write succeded, but updating activity ' +
          'dates on related entities failed with error: ' + err.message
      logErr(err)
      return finish(err)
    }
    logActions()
  })

  // log actions
  function logActions() {
    if (!options.actionEvent) return finish()

    var action = {
      event: options.actionEvent,
      _user: options.user._id,
      _entity: link._to,
    }

    db.actions.safeInsert(action, {user: util.adminUser}, function(err) {
      if (err) {
        err.message = 'Warning, link write succeded, but inserting action ' +
            'failed with error: ' + err.message
        logErr(err)
      }
      return finish(err)
    })
  }

  function finish(err) {
    return ('remove' === state.method)
      ? cb(err, meta)
      : cb(err, link, meta)
  }
}


// Determines whether adding or deleting a link should cause
// the linked-to entity to have its activty date updated
// TODO: rationalize with similar function in _entity.js
function isStrong(link) {
  if (statics.typeContent === link.type) return true
  else if (statics.typeWatch === link.type) return true
  else return false
}


// Returns a mongodb filter object that will return
// Strong links
function isStrongFilter() {
  return {type: statics.typeContent}
}

exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
