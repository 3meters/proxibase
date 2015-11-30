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
var push = require('../routes/do/push')

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    type:         { type: 'string', required: 'true',
                      value: 'watch|like|proximity|create|content|share'},
    enabled:      { type: 'boolean', default: true }, // controls link active state
    mute:         { type: 'boolean' },
    position:     { type: 'number' },
    signal:       { type: 'number' },
    proximity:    { type: 'object', deprecated: true, value: {
      primary:      { type: 'boolean' },
      signal:       { type: 'number' },
    }},
  },

  indexes: [
    { index: 'enabled' },
    { index: '_creator' },
    { index: '_created' },
    { index: 'createdDate' },
    { index: {_from: 1, toSchema: 1, type: 1, modifiedDate: 1}},
    { index: {_to: 1, fromSchema: 1, type: 1, modifiedDate: 1}},
    { index: {_from: 1, toSchema: 1, type: 1, enabled: 1, modifiedDate: 1}},
    { index: {_to: 1, fromSchema: 1, type: 1, enabled: 1, modifiedDate: 1}},
    { index: {_to: 1, fromSchema: 1, type: 1, _creator: 1}},                  // for user notification feed
  ],

  before: {
    insert: [canLinkFrom, canReadTo, canLinkTo, setProps],
    update: [checkUpdate],
    remove: [canRemove, decrementStats],
  },

  after: {
    insert: after,
    update: after,
    remove: after,
  },

  methods: {
    isStrong: isStrong,
  },

}


function canLinkFrom(link, previous, options, next) {

  var docFrom = options.docFrom
  if (!docFrom) return next(perr.badValue(link._from))

  // Admin
  if (options.asAdmin) return next()

  // User owns _from, the common case for the client
  if (options.user._id === docFrom._owner) return next()

  // We allow logged-in users to create proximity links
  // from patches they do not own
  if ((link.type === 'proximity')
      && (link.fromSchema === 'patch')
      && (link.toSchema === 'beacon')
      && (options.user._id !== util.anonId)) {
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

  var ops = _.cloneDeep(options)
  ops.refs = {_owner: 'name,schema,photo'}  // for notifications

  // safeFindOne will do an acl-based permission check
  this.db[clTo].safeFindOne({_id: link._to}, ops, function(err, docTo, updatedOps) {
    if (err) return next(err)
    if (!docTo) {
      return next(perr.badValue(link._to))
    }
    options.docTo = docTo
    options.asReader = updatedOps.asReader
    next()
  })
}


function canLinkTo(link, previous, options, next) {

  var docTo = options.docTo

  if (docTo.restricted && !options.asReader
      && (options.user._id !== docTo._owner)
      && (link.type !== 'watch')) {   // means a request to watch, will be created disabled
    // options.clTo may be a public, yet restricted patch, look for explicity watch link
    this.db[options.clTo].userIsWatching(options.user._id, options.docTo, {tag: options.tag}, function(err, isWatching) {
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
  var db = this.db

  doc._owner = docTo._owner

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
  if ((doc._from !== previous._from) ||
      (doc._to !== previous._to) ||
      (doc.type !== previous.type)) {
    return next(perr.forbidden('You cannot change the _from, _to, or type properties of a link'))
  }

  var userId = options.user._id
  if (userId === doc._owner) return next()
  if (userId !== options.docTo._owner && userId !== options.docFrom._owner) {
    return next(perr.badAuth())
  }
  if (doc.enabled !== previous.enabled && userId !== doc._owner) {
    return next(perr.forbidden('Only the link owner can change the enabled property'))
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


// Decrement stat counts when a link is removed, first checking to see whether
// it has been included in the stats calucations  This may not be worth the
// perf hit -- the alternative is to rebuild all the stats each night
// Note that due to unusual structure of the underlying table, we don't
// use the safe methods to perform the updates
function decrementStats(doc, previous, options, next) {

  var lastToStatQuery = {_id: 'sy.lastLinkStat_to'}
  var lastFromStatQuery = {_id: 'sy.lastLinkStat_from'}
  var db = this.db

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
    db.sys.safeFindOne(lastToStatQuery, {asAdmin: true, tag: 'stats'}, function(err, lastStat) {
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
    db.sys.safeFindOne(lastFromStatQuery, {asAdmin: true, tag: 'stats'}, function(err, lastStat) {
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
  var options = state.options
  var docTo = options.docTo       // set by _links.js
  var docFrom = options.docFrom   // set by _links.js
  var clFrom = options.clFrom
  var meta = state.meta || {}


  // Perform 3 async tasks in series
  async.waterfall([
    setActivityDates,
    setFromAcl,
    sendNotifications,
  ], finish)


  // Tickle the activity date of the affected entities
  function setActivityDates(next) {

    setDate(docTo, function(err) {
      if (err) return partialFail(err)
      setDate(docFrom, function(err) {
        if (err) return partialFail(err)
        next()
      })
    })

    function setDate(doc, cb) {

      if (!doc) return cb()  // many reasons this can be ok

      var schema = db.safeSchema(doc.schema)
      if (!schema) return cb(perr.serverError('Unkown schema for doc:', doc))

      if (!schema.fields.activityDate) return cb()

      if (!isStrong(link)) return cb()

      // Tickle activity date for linked-to entity
      var newActivityDate = util.now()
      if ('update' === state.method) newActivityDate = link.modifiedDate

      var activityDateWindow = (tipe.isDefined(options.activityDateWindow))
        ? options.activityDateWindow
        : statics.activityDateWindow

      if (doc.activityDate && (doc.activityDate + activityDateWindow > newActivityDate)) {
        return cb()
      }

      var update = {
        _id: doc._id,
        schema: doc.schema,
        activityDate: newActivityDate,
      }

      db[schema.collection].updateActivityDate(update, cb)
    }

    function partialFail(err) {
      err.message = 'Warning, link write succeded, but updating activity ' +
          'dates on related entities failed with error: ' + err.message
      logErr(err)
      return next(err)
    }
  }


  // For content links set the acl of the from document to
  // either the _acl or the _id of the to document.  This
  // is how permissions are cascaded down under a patch.
  function setFromAcl(next) {

    if (state.method !== 'insert') return next()
    if (link.type !== 'content') return next()
    var update = {
      _id: link._from,
      _acl: docTo._acl || docTo._id
    }
    var updateOps = {
      user: options.user,
      tag: options.tag,
      skipActivityUpdate: true,
    }
    db[clFrom].safeUpdate(update, updateOps, function(err, savedFrom) {
      if (err) return next(err)
      if (savedFrom) docFrom._acl = savedFrom._acl
      next()
    })
  }


  // Send notifications
  function sendNotifications(next) {

    if (options.user._id === statics.adminId) return next()

    var actionEvent = buildActionEvent()
    if (!actionEvent) return next()

    var sendOps = {
      event:      actionEvent,
      triggers:   ['own_to'],
      toId:       link._to,
      to:         docTo,
      fromId:     link._from,
      from:       docFrom,
      blockedId:  options.user._id,
      link:       link,
      tag:        options.tag,
      test:       options.test,
      log:        options.test || options.log || options.debug,
    }

    if (actionEvent.match(/^insert_entity.*content$/)) {
      sendOps.triggers = ['watch_to']
    }

    // Special case the approval of a watch link.
    // In this case the action should trigger a notification
    // To the from side of the link -- the user who created
    // the disabled watch link, aka a request to view a
    // private path.
    if (actionEvent === 'approve_watch_entity') {
      sendOps.triggers = ['own_from', 'own_to']
    }

    // Special case creating a patch
    if (actionEvent === 'insert_entity_patch') {
      if (!docTo.location) return next()
      sendOps.triggers = ['nearby']
      sendOps.locations = [docTo.location]
    }

    if (!options.test) {
      // FAST FINISH: We do not wait for the callback from push.
      push.sendNotification(sendOps)
      return next()
    }
    else {
      // WAIT: We wait for the callback from push. Primarily used for testing.
      push.sendNotification(sendOps, function(err, notifications) {
        if (err) {
          err.info = 'Error sending notifications'
          err.options = sendOps
          meta.errors = meta.errors || []
          meta.errors.push(err)
          util.logErr(err)
          return finish(err)
        }
        meta.notifications = notifications
        next()
      })
    }
  }


  // Construct the notification event
  function buildActionEvent() {

    if (state.method === 'insert') {
      switch (link.type) {

        case 'create':
          if (link.toSchema === 'patch') {
            return 'insert_entity_patch'
          }
          break

        case 'like':
          return 'like_entity_' + link.toSchema
          break

        case 'watch':
          if (link.toSchema === 'patch') {
            if (link.enabled) {
              if (options.docTo.restricted) return 'approve_watch_entity'  // user had a share message to a private patch
              else return 'watch_entity_patch'
            }
            else return 'request_watch_entity'  // private patch
          }
          break

        case 'content':
          if (link.toSchema === 'patch') {
            return 'insert_entity_' + link.fromSchema + '_content'
          }
          break

        case 'share':
          return 'insert_entity_' + link.fromSchema + '_share'
          break
      }
    }

    if (state.method === 'update') {
      if (link.type === 'watch' && link.enabled && !state.previous.enabled) {
        return 'approve_watch_entity'  // should be patch, but backward compat
      }
    }
  }

  function finish(err) {
    return ('remove' === state.method)
      ? cb(err, meta)
      : cb(err, link, meta)
  }
}


// Determines whether adding or deleting a link should cause
// the linked-to entity to have its activty date updated
function isStrong(link) {
  var strongLinks = {content: 1, watch: 1, like: 1}
  if (strongLinks[link.type]) return true
  return false
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
