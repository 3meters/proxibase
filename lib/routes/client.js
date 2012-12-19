/**
 * routes/client
 *   get and set the client version
 */

var util = require('util')
var log = util.log
var config = util.config
var docs = util.db.documents
var staticVersion = util.statics.clientVersion


exports.addRoutes = function(app) {
  app.get('/client', get)
  app.post('/client', post)
}

/*
 * The refresh param forces a read from the database
 * This allows for the db to updated directly without going through the API
 * In this case, if bad data was entered through the back door, give an error
 * and don't update the version
 */
function get(req, res) {
  if (!req.query.refresh) return res.send(staticVersion)
  return read(function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.send(staticVersion)
    return res.send(doc)
  })
}

function post(req, res) {
  if (!req.asAdmin) return finish(proxErr.badAuth('Requires admin'))
  if (!(req.body && req.body.data && req.body.data.version)) {
    return finish(proxErr.missingParam('body.data.version'))
  }
  if (req.body._id && req.body._id !== staticVersion._id) {
    return finish(proxErr.badValue('body._id should be omitted or ' + staticVersion._id))
  }
  var parsed = parse(req.body.data.version)
  if (!parsed) return finish(proxErr.badValue(req.body.data.version))
  var doc = {_id: staticVersion._id, data: req.body.data}
  docs.safeUpsert(doc, {user: req.user}, finish)

  function finish(err, doc) {
    if (err) return res.error(err)
    config.clientVersion = doc.data.version
    config.clientVersionParsed = parsed
    res.send(doc)
  }
}

var read = exports.read = function(cb) {
  docs.findOne({ _id: staticVersion._id }, function(err, doc) {
    if (err) return cb(err)
    if (doc) {
      var err = new Error('Invalid client version document in database')
      if (!(doc.data && doc.data.version)) return cb(err)
      var version = parse(doc.data.version)
      if (!version) return cb(err)
      config.clientVersion = doc.data.version
      config.clientVersionParsed = version
    }
    else {
      config.clientVersion = staticVersion.data.version
      config.clientVersionParsed = parse(staticVersion.data.version)
    }
    cb(null, doc)
  })
}

/*
 * Validate a client version passed as a query param
 * If lower than the server's major or minor return badVersion error
 * telling the client to force an upgrade
 * If the majors and minors match, but the server build number is greater,
 * tag each request with an upgrade = true param which will be added to
 * the response object by res.send
 */
exports.validate = function(req, res, next) {
  var sver = config.clientVersionParsed
  var cver = parse(req.query.version)
  if (!cver) return res.error(proxErr.badValue('version'))
  if (sver.major > cver.major || sver.minor > cver.minor) {
    return res.error(proxErr.badVersion('Current: ' + stringify(sver)))
  }
  if (sver.build > cver.build) req.upgrade = true
  next()
}

// Returns the parsed version string if valid, otherwise null
// Versions must be of the form 'int.int.int'
function parse(version) {
  if (typeof version !== 'string') return null
  var elems = version.split('.')
  if (elems.length !== 3) return null
  var parsed = {
    major: parseInt(elems[0], 10),
    minor: parseInt(elems[1], 10),
    build: parseInt(elems[2], 10)
  }
  for (var e in parsed) {
    if (isNaN(parsed[e])) return null
  }
  return parsed
}

function stringify(v) {
  return v.major + '.' + v.minor + '.' + v.build
}

