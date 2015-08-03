/*
 * Actions schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sAction = statics.schemas.action
var push = require('../routes/do/push')
var util = require('proxutils')   // jshint ignore:line

var action = {
  /*
   * [_user] did [event] to [_entity]
   */
  id: sAction.id,
  name: sAction.name,
  collection: sAction.collection,
  system: true,

  fields: {
    event:              { type: 'string', required: true },                   // action event: like_post, watch_patch, etc.
    _user:              { type: 'string', required: true, ref: 'users' },     // user causing the action
    _entity:            { type: 'string', required: true, },                  // entity targeted by action
    _toEntity:          { type: 'string' },                                   // entity also effected by action
    _link:              { type: 'string' },                                   // optional if action was trigged by link
  },

  indexes: [
    {index: { _entity: 1, event: 1 }},  // More efficient for countBy queries, $or operations
    {index: { _user: 1, event: 1 }},    // More efficient for countBy queries, $or operations
    {index: { _toEntity: 1 }},          // Used in $or operations
  ],

  after: {
    insert: after,
  }
}


// Optionally send notifications based on logged actions.  We could probably
// simplify this by just implementing as triggers on the links collection
// itself, skipping the actions collection altoghter
function after(err, state, cb) {

  var action = state.document
  var options = state.options
  var meta = state.meta

  // Noop in default, non-production config, unless specifically asked
  // for via options.test, which is set in test requests
  if (!(util.config.sendNotifications || options.test)) return finish()

  // Only notify real users
  if (!options.user) return finish()
  if (options.user._id === util.anonId) return finish()

  // Whitelist events that generate notifications
  var notifyEvents = [
    'insert_entity_patch',
    'insert_entity_message',
    'watch_entity_patch',
    'request_watch_entity',
    'approve_watch_entity',
    'like_entity_patch',
    'like_entity_message',
  ]
  if (notifyEvents.indexOf(action.event) < 0) return finish()

  // Ensure we have already notified within the past 15 minutes
  // Jayma: FIXME increase timeLimit or we are vulnerable to notification spamming!
  // var timeLimit = util.now() - (15 * 60 * 1000)
  var timeLimit = util.now() - (1000)
  var qry = {
    event: action.event,
    _user: action._user,
    _entity: action._entity,
    createdDate: {$gte: timeLimit},
  }

  this.db.actions.safeFind(qry, {asAdmin: true, count: true}, function(err, count) {
    if (err) return finish(err)
    if (count > 1) {
      // Already sent a notification within the time limit, skip
      if (options.log) log('skipping notifications for ', action)
      return finish()
    }
    sendNotification()
  })

  // Send the notification
  function sendNotification() {

    var triggers = ['own_to']
    if (action.event === 'approve_watch_entity') {
      triggers = ['own_from']
    }

    var sendOps = {
      event:      action.event,
      triggers:   triggers,
      toId:       action._entity,
      fromId:     action._user,
      blockedId:  options.user._id,
      log:        options.log || options.debug,
    }

    if (options.link) {
      if (!action._link) action._link = options.link._id
      sendOps.link = _.cloneDeep(options.link)
    }

    if (!options.test) {
      // FAST FINISH: We do not wait for the callback from push.
      push.sendNotification(sendOps)
      return finish()
    }
    else {
      // WAIT: We wait for the callback from push. Primarily used for testing.
      push.sendNotification(sendOps, function(err, notifications) {
        if (err) {
          err.info = 'Error sending notifications'
          err.action = action
          err.options = sendOps
          meta.errors = meta.errors || []
          meta.errors.push(err)
          util.logErr(err)
        }
        else meta.notifications = notifications
        finish()
      })
    }
  }

  function finish(err) {
    cb(err, action, meta)
  }
}


exports.getSchema = function() {
  return mongo.createSchema(base, action)
}
