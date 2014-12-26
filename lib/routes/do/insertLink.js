/*
 * insertLink: Insert a link and trigger various notifications.
 *
 */

var push = require('./push')
var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

var _body = {

  fromId:               { type: 'string', required: true },
  toId:                 { type: 'string', required: true },
  type:                 { type: 'string', required: true },
  enabled:              { type: 'boolean', default: true },
  linkId:               { type: 'string' },
  actionEvent:          { type: 'string' },
  returnNotifications:  { type: 'boolean', default: false },
  activityDateWindow:   { type: 'number' },                   // for testing to override system default
  forceNotify:          { type: 'boolean', default: false },  // for testing to skip notification spam blocking
  log:                  { type: 'boolean' },
}

/* Request body template end =========================================== */

// Public web service
exports.main = function(req, res) {

  var options = util.clone(req.body)
  var err = scrub(options, _body)
  if (err) return res.error(err)

  var notifications = []
  var actionEvent = options.actionEvent
  var notify = options.forceNotify
  var link = {
    _id: options.linkId,
    _from: options.fromId,
    _to: options.toId,
    type: options.type,
    enabled: options.enabled,
  }

  if (!link._id) {
    var id = db.links.genId(link)
    link._id = id
  }

  delete options.fromId
  delete options.toId
  delete options.type
  delete options.enabled
  delete options.linkId

  _.extend(options, req.dbOps)

  if (actionEvent === 'watch_entity_patch'
    || actionEvent === 'request_watch_entity'
    || actionEvent === 'approve_watch_entity'
    || actionEvent === 'like_entity_patch'
    || actionEvent === 'like_entity_message') {
    validate()
  }
  else {
    return insert()
  }

  function validate() {
    /*
     * To prevent notification spamming, we check to see if an action
     * has already been logged with the same signature and principal
     * entities in the last 15 minutes.
     */
    var timeLimit = util.getTime() - 915000 // 15 minutes
    var query = {
      event: actionEvent,
      _user: link._from,
      _entity: link._to,
      createdDate: { $gte: timeLimit },
    }
    var ops = util.clone(req.dbOps)
    ops.asAdmin = true
    db.actions.safeFindOne(query, ops, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) notify = true
      else {
        log('Skipping notification')
        if (options.log) log('action hit: ', query)
      }
      insert()
    })
  }

  function insert() {
    db.links.safeUpsert(link, options, function(err, savedLink) {
      if (err || !savedLink) return res.error(err)
      link = savedLink

      if (util.anonId === req.user._id)
        return done()  // don't send notifications from anon user

      if (notify) {
        loadEntities()
      }
      else {
        return done()
      }
    })
  }

  function loadEntities() {
    options.entityIds = [ link._to, link._from ]
    getEntities(req, options, function(err, entities) {
      if (err || !entities || entities.length === 0) return done(err)
      entities.forEach(function(entity){
        if (entity._id === link._to) req.toEntity = entity
        if (entity._id === link._from) req.fromEntity = entity
      })
      sendNotification()
    })
  }

  function sendNotification() {
    log('sendNotification')
    /*
     * We do not throw an error for insertLink if push
     * fails since it is not a failure of the actual insert operation.
     * We log the error instead.
     */
    var triggers = ['own_to']
    if (actionEvent === 'approve_watch_entity') {
      triggers = ['own_from']
    }

    var options = {
      event:      actionEvent,
      triggers:   triggers,
      to:         req.toEntity,
      from:       req.fromEntity,
      link:       link,
      blockedId:  req.user._id,
    }

    if (!req.body.returnNotifications) {
      // FAST FINISH: We do not wait for the callback from push.
      push.sendNotification(options)
      done()
    }
    else {
      // WAIT: We wait for the callback from push. Primarily used for testing.
      push.sendNotification(options, function(err, _notifications) {
        if (err)
          util.logErr('Error sending notification', err)
        else
          notifications = _notifications
        done()
      })
    }
  }

  function done() {
    var response = {
      count: 1,
      date: util.now(),
    }

    response.data = [link]
    if (req.body.returnNotifications) {
      response.notifications = notifications
    }

    if (req.error) res.error(req.error, response)
    else res.send(201, response)
  }
}
