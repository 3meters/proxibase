/**
 * /routes/shares.js
 *
 *    Create and manage share requests
 */

var async = require('async')
var qs = require('qs')


// Data router
function addRoutes(app) {
  app.get('/shares/?', welcome)
  app.post('/shares/?', main)
  app.get('/shares/from/me/?', fromme)
  app.get('/shares/to/me/?', tome)
  app.get('/share/:shareId/accept', accept)
}


// Body spec
var bodySpec = {
  _share:       { type: 'string', required: true, comment: '_id of entity being shared' },
  _tos:         { type: 'array', required: true, value: {type: 'string'}, comment: 'array of user._ids to share with'},
  description:  { type: 'string' },
}


// Suggest users
function welcome(req, res) {
  res.send({
    comment: 'All requests to /shares except this one must be authenticated',
    endpoints: {
      'get /shares': {
        comment: 'get this message',
      },
      'post /shares': {
        params:   bodySpec,
        comment1: 'Can return partial success if some shares are created and others fail.',
        comment2: 'In that case res.statusCode will be 200, but there will be an errors ',
        comment3: 'array in the response body.',
      },
      'get /shares/from/me': {
        params:   'All rest query params are accepted. None are required.',
      },
      'get /shares/to/me': {
        params:   'All rest query params are accepted. None are required',
        comment:  'Filters out requests from users I have ignored',
      },
      /*
      'get /shares/<shareId>/accept': {
        params: 'none',
        comment1: 'Generates an error if the requesting user is not the _to of the share.',
        comment2: 'Changes status from pending to accepted.  If shared entity is watchable',
        comment3: 'creates a watch link.'
      }
      */
    }
  })
}


// Public web service
function main(req, res) {

  run(req.body, req.dbOps, function(err, shares, shareErrors) {
    if (err) return res.error(err)
    var result = {
      data: shares,
      date: util.getTimeUTC(),
      count: shares.length,
    }
    if (shareErrors) result.errors = shareErrors
    res.send(result)
  })
}


// Private worker
function run(body, dbOps, cb) {

  var err = scrub(body, bodySpec)
  if (err) return cb(err)

  var shares = []
  var shareErrors = []

  async.eachSeries(body._tos, createShare, function(err) {
    if (err) return cb(err)
    if (!shareErrors.length) return cb(null, shares)  // no errors
    if (!shares.length) return cb(shareErrors[0])     // no results and some errors, return first error as a failure
    return cb(null, shares, shareErrors)              // some results and some errors, return both as success
  })

  function createShare(userId, nextUser) {

    var doc = {
      _to: userId,
      _share: body._share,
      description: body.description,
    }

    db.shares.safeInsert(doc, dbOps, function(err, share) {
      if (err) shareErrors.push(err)
      if (!share) return nextUser()

      shares.push(share)

      var createLink = {
        _to: share._id,
        _from: dbOps.user._id,
        type: 'create',
      }

      dbOps.actionEvent = 'insert_entity_share'

      db.links.safeInsert(createLink, dbOps, function(err) {
        if (err) return cb(err)

        var shareLink = {
          _to: share._to,
          _from: share._id,
          type: 'content',
        }

        // TODO:  Need help from Jay to decide how we should notifiy
        // users that they have been invited.  Actions table doesn't
        // feel right, since the invitees have not acted.
        delete dbOps.actionEvent

        db.links.safeInsert(shareLink, dbOps, function(err) {
          if (err) return cb(err)
          nextUser()
        })
      })
    })
  }
}


// Find all shares from me
function fromme(req, res) {
  if (!req.user) return res.error(perr.badAuth())

  req.query.query = req.query.query || {}
  _.extend(req.query.query, {_owner: req.user._id})
  redirect(req, res)
}


// Find all shares to me except from those users I have ignored
function tome(req, res) {
  if (!req.user) return res.error(perr.badAuth())

  req.query.query = req.query.query || {}
  _.extend(req.query.query, {_to: req.user._id})

  db.ignores.safeFind({}, req.dbOps, function(err, ignores) { // ignores is ownerAccess
    if (err) return res.error(err)

    if (!ignores.length) return redirect(req, res)

    var ignoreIds = ignores.map(function(ignore) { return ignore._ignore })
    util.extend(req.query.query, {$nin: ignoreIds})

    redirect(req, res)
  })
}


// Redirect to /find/shares with our fixed-up query
function redirect(req, res) {
  res.redirect(req.apiVersionPrefix + '/find/shares?' + qs.stringify(req.query))
}


// NYI:  create watch links for watchable entities.  Do what for non-watchable ones?
function accept(req, res) {
  res.send({info: 'nyi'})
}


exports.addRoutes = addRoutes
