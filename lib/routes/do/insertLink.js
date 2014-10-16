/*
 * insertLink
 *
 *   This is here for only backward compat.  All its functionality has been composted down into
 *   the _link.js and link.js schemas.
 *
 *   This is exactly equal to calling:
 *
 *   POST:  /data/links?userCred
 *   body: {
 *     data: {
 *       _to: <toId>,
 *       _from: <fromId>,
 *       type: <type>,
 *     },
 *     actionEvent: ...,
 *     activityDateWindow: ...,
 *     log: ...
 *  }
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
  activityDateWindow:   { type: 'number' },      // for testing to override system default
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

  db.links.safeUpsert(link, options, function(err, savedLink) {
    if (err || !savedLink) return res.error(err)
    link = savedLink

    if (util.anonId === req.user._id)
      return done()  // don't send notifications from anon user

    if (actionEvent === 'watch_entity_place'
      || actionEvent === 'request_watch_entity'
      || actionEvent === 'approve_watch_entity') {
      loadEntities()
    }
    else {
      return done()
    }
  })

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
      event: actionEvent,
      triggers: triggers,
      to: req.toEntity,
      from: req.fromEntity,
      link: link,
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