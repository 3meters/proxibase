/*
 * insertLink: Insert a link and trigger various notifications.
 *
 */

var methods = require('./methods')
var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

var _body = {
  fromId:             { type: 'string', required: true },
  toId:               { type: 'string', required: true },
  type:               { type: 'string', required: true },
  enabled:            { type: 'boolean', default: true },
  actionEvent:        { type: 'string' },
  returnMessages:     { type: 'boolean', default: false },
  activityDateWindow: { type: 'number' },      // for testing to override system default
  log:                { type: 'boolean' },
}

/* Request body template end =========================================== */

// Public web service
exports.main = function(req, res) {

  var options = util.clone(req.body)
  var err = scrub(options, _body)
  if (err) return res.error(err)

  var messages = []
  var link = {
    _from: options.fromId,
    _to: options.toId,
    type: options.type,
    enabled: options.enabled,
  }

  delete options.fromId
  delete options.toId
  delete options.type
  delete options.enabled

  _.extend(options, req.dbOps)

  db.links.safeInsert(link, options, function(err, savedLink) {
    if (err || !savedLink) return res.error(err)
    req.savedLink = savedLink

    if (util.anonId === req.user._id)
      return done()  // don't send messages from anon user

    if (req.savedLink.type !== 'watch')
      return done()

    getToEntity()
  })

  function getToEntity() {
    options.entityIds = [ req.savedLink._to ]
    getEntities(req, options, function(err, items) {
      if (err || !items || items.length === 0) return done(err)
      req.toEntity = items[0]
      sendMessage()
    })
  }

  function sendMessage() {
    log('sendMessage')
    /*
     * We do not throw an error for insertLink if sendMessage
     * fails since it is not a failure of the actual insert operation.
     * We log the error instead.
     */
    var fakeId = req.savedLink._id.replace('li', 'me')
    var toShortcut = {
        _id: req.toEntity._id,
        name: req.toEntity.name,
        photo: req.toEntity.photo,
        schema: req.toEntity.schema,
    }
    var userCompact = {
        _id: req.user._id,
        name: req.user.name,
        photo: req.user.photo,
        schema: 'user',
    }
    var admin = {
        _id: util.adminId,
        name: 'Patch',
    }
    var message = {
      _id: fakeId,
      type: 'alert',
      schema: 'message',
      _owner: userCompact._id,
      _creator: userCompact._id,
      _modifier: util.adminId,
      createdDate: req.savedLink.createdDate,
      modifiedDate: req.savedLink.modifiedDate,
      synthetic: true,
      enabled: true,
      description: 'Started watching: ' + toShortcut.name, // TODO: localize
      visibility: 'public',
      restricted: false,
      _place: toShortcut._id,
      place: toShortcut,
      creator: userCompact,
      modifier: userCompact,
      onwer: admin,
    }
    message.linksOut = []
    message.linksOut.push(
      {
        _to: toShortcut._id,
        type: req.savedLink.type,
        targetSchema: toShortcut.schema,
        _owner: admin._id,
        shortcut: toShortcut,
      }
    )

    var serviceMessage = {
      event: 'insert_link' + '_' + req.savedLink.type,
      entity: message,
      toId: req.toEntity._id,
      user: req.user,
      triggers: ['own_to'],
    }

    if (!req.body.returnMessages) {
      /* FAST FINISH: We do not wait for the callback from sendMessage. */
      methods.sendMessage(serviceMessage)
      done()
    }
    else {
      /* WAIT: We wait for the callback from sendMessage. Primarily used for testing. */
      methods.sendMessage(serviceMessage, function(err, _messages) {
        if (err)
          util.logErr('Error sending message', err)
        else
          messages = _messages
        done()
      })
    }
  }

  function done() {
    var response = {
      count: 1,
      date: util.now(),
    }

    response.data = [req.savedLink]
    if (req.body.returnMessages) {
      response.messages = messages
    }

    if (req.error) res.error(req.error, response)
    else res.send(201, response)
  }
}
