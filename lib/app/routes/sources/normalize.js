/**
 * normalize.js
 *
 *   Given a source, fill out its id property with something that can be
 *   sorted and deduped.  Breaking node norms, returns null, not an Error,
 *   on a bad source. Why? because failure is the common case and we
 *   want the caller to procede without interuption.  
 */

var callService = util.callService
var url = require('url')
var _sources = util.statics.sources
var norm = { // custom normalizers
  twitter: normTwitter,
  facebook: normFacebook
}

// Main worker
function normalize(source, cb) {
  if (!(source.type && (source.id || source.url))) {
    return bail(source, cb)
  }
  if (source.id) source.id = String(source.id)
  if (!_sources[source.type]) source.hidden = true  // pass through but don't display
  if (norm[source.type]) norm[source.type](source, cb)
  else cb(null, source)
}


// Log an error and return null
function bail(source, cb, err) {
  if (!type.isError(err)) err = perr.badSource(err)
  logErr(err.message, source)
  if (err.stack) logErr(util.appStack(err.stack))
  cb(null)
}


function normFacebook(source, cb) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) return bail(source, cb, 'Could not parse url')
    var paths = u.pathname.split('/')
    // guess that the id is the last path element
    source.id = paths[paths.length -1]
  }
  if (!source.id) return bail(source, cb, 'Could not get id from url')
  var query = source.id + '?fields=name,username'
  callService.facebook(query, function(err, res) {
    if (err) return bail(source, cb, err)
    var body = res.body
    if (body.username && body.username.length) {
      source.id = body.username
      source.name = body.name
    }
    else return bail(source, cb)
    return cb(null, source)
  })
}

function normTwitter(source, cb) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) return bail(source, cb)
    if (u.pathname.length > 1) {
      log('foo')
      source.id = u.pathname.split('/')[1]
    }
    else {
      log('bar')
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        log('barbar')
        source.id = u.hash.slice(1).split('/')[1]
        log('source.id: ' + source.id)
      }
    }
  }
  if (!source.id) return bail(source, cb)
  var id = source.id.toLowerCase()
  source.id = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!source.id.length) return bail(source, cb)
  source.name = '@' + source.id
  cb(null, source)
}

module.exports = normalize