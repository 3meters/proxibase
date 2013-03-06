/**
 * sources.js
 *
 *  Web link destinations that we understand and promote in the client UI
 *
 *    The public object util.statics.sources is created by init
 */

var callService = util.callService
var fs = require('fs')
var path = require('path')
var url = require('url')
var request = require('superagent')
var _sources = util.statics.sources


function bail(err, source, cb) {
  if (!err || type.isString(err)) {
    err = perr.badSource(err)
  }
  if (!type.isError(err)) {
   throw new Error('Invalid call to bail')
  }
  logErr(err.message, source)
  if (err.stack) logErr(util.appStack(err.stack))
  cb(null)
}

/*
 * Normalize source
 *
 *    Clean or up or purne a source. All changes are made in place
 *    on the referenced source.
 *
 *    This function breaks node norms and does not not return errors.
 *    Instead it indicates that a source is bad by setting it to null.
 *    Why? Because failure is the common case.
 *
 *    Sources with valid-seeming but unknown fingerprints pass
 *    through unbotherd.
 *
 */
function normalize(source, cb) {
  if (!source.type) {
    return bail('Missing source type', source, cb)
  }
  if (!(source.id || source.url)) {
    return bail('Missing source id and source url', source, cb)
  }
  if (source.id) source.id = String(source.id)  // paranoid scrub
  var _source = _sources[source.type]
  if (!_source) source.hidden = true  // we will round-trip but not display
  if (_source && type.isFunction(_source.normalize)) {
    // Source has a normalize function
    _source.normalize(source, cb)
  }
  else cb(source)
}


function normFacebook(source, cb) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) { return bail('Could not parse url', source, cb) }
    var paths = u.pathname.split('/')
    // guess that the id is the last path element
    source.id = paths[paths.length -1]
  }
  if (!source.id) return bail('missing id', source, cb)
  var query = source.id + '?fields=name,username'
  callService.facebook(query, function(err, res) {
    if (err) return bail(err, source, cb)
    var body = res.body
    if (body.username && body.username.length) {
      source.id = body.username
      source.name = body.name
    }
    else {
      return bail(null, source, cb)
    }
    return cb(source)
  })
}

function normTwitter(source, cb) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) { return bail('Could not parse url', source, cb) }
    if (u.pathname.length > 1) {
      source.id = u.pathname.split('/')[1]
    }
    else {
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        source.id = u.hash.slice(1).split('/')[1]
      }
    }
  }
  if (!source.id) {
    return bail('missing id', source, cb)
  }
  var id = source.id.toLowerCase()
  source.id = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!source.id.length) return bail('missing id', source, cb)
  source.name = '@' + source.id
  cb(source)
}

// Wire up source icon uris based on service uri
function computeIconUris() {
  var service = util.config.service
  var assetsDir = '../../../../assets/'
  var iconDir = '/img/sources/'
  var suffix = '.png'
  for (var name in _sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!_sources[name].props) _sources[name].props = {}
    _sources[name].props.icon = iconDir + filename + suffix
  }
}

// Extend util.statics.sources
function init() {
  computeIconUris()
  _sources.facebook.normalize = normFacebook
  _sources.twitter.normalize = normTwitter
}

// Run by index.js on module load
exports.init = init
exports.normalize = normalize
