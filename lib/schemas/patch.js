/**
 *  Patches schema
 */

var mongo = require('../mongosafe')
var async = require('async')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var staticPatch = statics.schemas.patch
var admin = util.adminUser
var tickleDelay = 1

var patch = {

  id: staticPatch.id,
  name: staticPatch.name,
  collection: staticPatch.collection,
  public: true,

  fields: {
    locked:       { type: 'boolean' },
    visibility:   { type: 'string', default: 'public', value: 'public|private' },
    restricted:   { type: 'boolean', default: false, value: function() {
      return (this.visibility === 'private' || this.locked)
    }},
  },

  indexes: [
    { index: { name: 'text', type: 'text', description: 'text' },
      options: { weights: { name: 10, type: 5, description: 3 }}},
  ],

  documents: [
    statics.welcomePatch  // Tips and Tricks patch for autowatching on user create
  ],

  before: {
    read:   [promoteSystemFields],
    insert: [addAutoWatchLink],
  },

  after: {
    update: [tickleLinks]
  }
}


// We need the visibility and restricted fields in order to check
// permissions.  Promote them to mandatory even if the caller
// specified a field list that did not include them.
function promoteSystemFields(query, options, next) {
  if (options.fields && !_.isEmpty(options.fields)) {
    options.fields.visibility = 1
    options.fields.restricted = 1
  }
  next()
}


// Non admin users automatically watch patches they create
function addAutoWatchLink(doc, previous, options, next) {
  if (options.user._id === admin._id) return next()
  options.links = options.links || []
  var hasWatchLink = options.links.some(function(link) {
    return (link._from === options.user._id && link.type === 'watch')
  })
  if (!hasWatchLink) {
    options.links.push({_from: options.user._id, type: 'watch'})
  }
  options.noTickle = true  // hint for after triggers
  next()
}


function tickleLinks(state, cb) {

  var patch = state.document
  var prev = state.previous
  var ops = state.options
  var self = this

  // Upstream function has told me to stand down
  if (ops.noTickle) return cb()

  if (patch.activityDate <= prev.activityDate) return cb()

  // TODO: test with and without ops.test set
  if ((patch.activityDate <= (prev.activityDate + statics.activityDateWindow)) && !ops.test) {
    return cb()
  }

  if (!ops.test) cb()  // Fire and forget on purpose

  var tickled = []

  var linkQry = {
    // _id: {$ne: statics.welcomePatch._id},   // Consider
    _to: patch._id,
    fromSchema: 'user',
    type: {$in: ['watch', 'create']},
  }

  var linkOps = util.adminOps(ops)
  linkOps.noTickle = true

  var cursor = this.db.links.find(linkQry, {timeout: false})

  async.forever(tickleLink)

  function tickleLink(next) {

    setTimeout(doTickle, tickleDelay)

    function doTickle() {
      cursor.nextObject(function(err, link) {
        if (err) return finish(err)
        if (link === null) return finish()    // done

        var tickle = {
          _id: link._id,
          activityDate: patch.activityDate,     // the rub
        }

        self.db.links.safeUpdate(tickle, linkOps, function(err, link) {
          if (err) return finish(err)
          if (link) tickled.push(link)
          next()
        })
      })
    }
  }

  function finish(err) {
    cursor.close()
    if (err) {
      err.message = 'Error in patch.tickleLinks: ' + err.message
      err.state = state
      logErr(err)
    }
    if (ops.test) {
      state.meta.tickledLinks = tickled
      cb(err, state)
    }
  }
}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, patch)
}
