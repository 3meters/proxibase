/*
 * /user/feed
 *
 * formerly /do/getNotifications
 *
 * Build the list of notifcations displayed in the feed page of the client
 * This should not be confused with sending push notifications to the client
 *
 * author: Jay
 * maintainer: George
 *
 */

var buildFeedItem = require('./buildFeedItem')

var spec = {
  userId:   {type: 'string', required: true },
  sort:     {type: 'object', default: {modifiedDate: -1},
    value: function() { return {modifiedDate: -1} }},  // ignore input and set
  skip:     {type: 'number', default: 0},
  more:     {type: 'boolean', default: true},
  limit:    {type: 'number', default: statics.db.limits.default,  // applied per entity type
    validate: function(v) {
      if (v > statics.db.limits.max) {
        return 'Max limit is ' + statics.db.limits.max
      }
    },
  },
  log: {type: 'boolean'},
}

// Public method
module.exports = function(req, res) {

  if (!req.dbOps.user) return res.error(perr.badAuth())

  // Runs with elevated permissions
  // Only valid for the currently authenticated user
  if (!req.dbOps.asAdmin) {
    req.body.userId = req.dbOps.user._id
  }

  // Legacy
  if (req.body.cursor) {
    req.body.limit = req.body.limit || req.body.cursor.limit
    req.body.skip = req.body.skip || req.body.cursor.skip
    delete req.body.cursor
  }

  var err = scrub(req.body, spec)
  if (err) return res.error(err)

  run(req.body, req.dbOps, function(err, feedItems, meta) {
    if (err) return res.error(err)
    res.send({
      data: feedItems,
      date: util.getTimeUTC(),
      count: feedItems.length,
      more: meta.more
    })
  })
}


// Internal method
function run(ops, dbOps, cb) {

  var userId = ops.userId
  var patchWatchIds = []
  var patchOwnIds = []
  var msgOwnIds = []

  var userLinks = []
  var entityIds = []
  var entities = []
  var meta = { more: false }

  findMyEntities()

  // Find the entities the user cares about
  function findMyEntities() {

    var seedOps = _.assign(_.cloneDeep(dbOps), {
      limit: statics.db.limits.join,
      sort: '-modifiedDate',
      fields:  {_to: 1},
    })

    // Find patches I watch
    var query = {_from: userId, toSchema: 'patch', type: 'watch', enabled: true}

    db.links.safeFind(query, seedOps, function(err, links) {
      if (err) return fail(err)

      links.forEach(function(link) { patchWatchIds.push(link._to) })

      seedOps.fields = {_id: 1}
      query = {_owner: userId}

      // Find patches I own
      db.patches.safeFind(query, seedOps, function(err, patches) {
        if (err) return fail(err)

        patches.forEach(function(patch) { patchOwnIds.push(patch._id) })

        // Find messages I own
        db.messages.safeFind(query, seedOps, function(err, msgs) {
          if (err) return fail(err)

          msgs.forEach(function(msg) { msgOwnIds.push(msg._id) })

          findLinks()
        })
      })
    })
  }


  function findLinks() {

    var query = {
      $or: [
        // Share messages to me
        {
          _to:        userId,
          fromSchema: 'message',
          type:       'share',
          _creator:   {$ne: userId},
        },
        // Content messages to patches I watch
        {
          _to:         { $in: patchWatchIds },
          fromSchema:  'message',
          type:        'content',
          _creator:    { $ne: userId },
        },
        // Watch links to patches I own
        {
          _to:         { $in: patchOwnIds },
          fromSchema:  'user',
          type:        'watch',
          _creator:    { $ne: userId },
        },
        // Like links to messages I own
        {
          _to:         { $in: msgOwnIds},
          fromSchema:  'user',
          type:        'like',
          _creator:    { $ne: userId },
        }
      ]
    }


    var findLinksOps = _.assign(_.cloneDeep(dbOps), _.pick(ops, 'sort', 'limit', 'skip', 'more'))

    db.links.safeFind(query, findLinksOps, function(err, links, linksMeta) {
      if (err) return fail(err)

      var entityMap = {}
      meta.more = (linksMeta && linksMeta.more)

      // Dedupe
      links.forEach(function(link) {
        entityMap[link._from] = link._from
        entityMap[link._to] = link._to
      })

      for (var key in entityMap) {
        entityIds.push(entityMap[key])
      }

      if (ops.log && links) {
        log('FindFroms: Total items found using links: ' + links.length)
        log('FindFroms: Total entity ids to lookup: ' + entityIds.length)
      }

      userLinks = links
      getDocs()
    })
  }

  function getDocs() {
    // Build and return the entity objects
    if (entityIds.length === 0) return cb(null, [], meta)

    // Grant authenticated user bulk read permissions on messages sent to her
    var findDocsOps = util.adminOps(dbOps)
    findDocsOps.refs =  {_creator: '_id,name,photo,schema,type'}

    db.safeFindByIds(entityIds, findDocsOps, function(err, docs) {
      if (err) return fail(err)
      entities = docs
      build()
    })
  }

  function build() {

    var feedItems = []

    userLinks.forEach(function(link) {

      var to = entities.reduce(function(a, b) {
        if (link._to === a._id) return a
        else return b
      })
      if (!to) return

      var from = entities.reduce(function(a, b) {
        if (link._from === a._id) return a
        else return b
      })
      if (!from) return

      var trigger
      if (ops.userId === to._owner)
        trigger = 'own_to'
      else if (ops.userId === from._owner)
        trigger = 'own_from'
      else
        trigger = 'watch_to'

      var event
      if (link.type === statics.typeWatch) {
        event = 'watch_entity_patch'
        if (to.visibility === 'private') {
          if (!link.enabled)
            event = 'request_watch_entity'
          else
            event = 'approve_watch_entity'
        }
      }
      else if (link.type === statics.typeContent) {
        event = 'insert_entity_message'
      }
      else if (link.type === statics.typeShare) {
        event = 'insert_entity_message_share'
      }
      else if (link.type === statics.typeCreate) {
        event = 'insert_entity_patch'
      }
      else if (link.type === statics.typeLike) {
        event = 'like_entity_' + link.toSchema
      }

      if (trigger) {
        var options = {
          event: event,
          to: to,
          from: from,
          link: link,
          trigger: trigger,
          priority: 2,   // These paint the feed in the UI, never chirp
        }

        var feedItem = buildFeedItem(options)
        feedItems.push(feedItem)
      }
    })

    meta.count = feedItems.length || 0
    cb(null, feedItems, meta)
  }

  function fail(err) {
    if (err) logErr(err)
    meta.count = 0
    cb(err, [], meta)
  }
}
