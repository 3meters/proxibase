/**
 * Create and mange share requests
 */

var async = require('async')
var qs = require('qs')


// Data router
function addRoutes(app) {
  app.get('/shares/?', welcome)
  app.post('/shares/?', main)
  app.get('/shares/from/me/?', fromme)
  app.get('/shares/to/me/?', tome)
}


// Options scurb spec
var optionsSpec = {
  _share:       { type: 'string', required: true, comment: '_id of entity being shared' },
  _tos:         { type: 'array', required: true, value: {type: 'string'}, comment: 'array of user._ids to share with'},
  description:  { type: 'string' }
}


// Suggest users
function welcome(req, res) {
  res.send({
    endpoint: 'share',
    method:   'post',
    params:   optionsSpec,
    comment1: 'Can return partial success if some shares are created and others fail.',
    comment2: 'In that case res.statusCode will be 200, but there will be an errors ',
    comment3: 'array in the response body.',
  })
}


// Public web service
function main(req, res) {

  var options = util.clone(req.body)
  options.user = req.user

  run(options, function(err, shares, shareErrors) {
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
function run(options, cb) {

  var err = scrub(options, optionsSpec)
  if (err) return cb(err)

  var shares = []
  var shareErrors = []

  async.eachSeries(options._tos, createShare, function(err) {
    if (err) return cb(err)
    if (!shareErrors.length) return cb(null, shares)  // no errors
    if (!shares.length) return cb(shareErrors[0])     // no results and some errors, return first error as a failure
    return cb(null, shares, shareErrors)              // some results and some errors, return both as success
  })

  function createShare(userId, nextUser) {
    db.shares.safeInsert({
      _to: userId,
      _share: options._share,
      description: options.description,
    }, {user: options.user}, function(err, share) {
      if (err) shareErrors.push(err)
      if (share) shares.push(share)
      nextUser()
    })
  }
}


// Find all shares from me
// Just redirects to the rest api since it is an owerAccess collection
function fromme(req, res) {
  if (!req.user) return res.error(perr.badAuth())
  res.redirect(req.apiVersionPrefix + '/find/shares?' + qs.stringify(req.query))
}


// Find all shares to me, filtering out users I ignore
function tome(req, res) {
  if (!req.user) return res.error(perr.badAuth())

  var findOps = {
    user: req.user,
    limit: statics.db.limits.max,
  }
  db.ignores.safeFind({_owner: req.user._id}, findOps, function(err, ignores) {
    if (err) return res.error(err)

    findOps = util.clone(req.body)
    findOps.user = req.user
    findOps.asAdmin = true  // becuase shares is onwerAccess

    var ignoreIds = ignores.map(function(ignore) {return ignore._ignore})
    var query = {
      $and: [
        {_to: req.user._id},
        {_owner: {$nin: ignoreIds}},
      ]
    }
    db.shares.safeFind(query, findOps, function(err, shares, meta) {
      if (err) return res.error(err)
      res.send({
        data: shares,
        count: shares.length,
        more: meta.more || false,
      })
    })
  })
}
exports.addRoutes = addRoutes
