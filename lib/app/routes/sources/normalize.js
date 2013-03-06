/**
 * normalize.js
 *
 *   Given a source, fill out its id property with something that can be
 *   sorted and deduped.  Returns null, not Error, on a bad source.
 */

var callService = util.callService
var url = require('url')
var request = require('superagent')
var _sources = util.statics.sources
var norm = {
  twitter: normTwitter,
  facebook: normFacebook
}

/*
 * Normalize source
 *
 *    Clean or up or purne a source.
 *
 *    This function breaks node norms and does not not return errors.
 *    Instead it indicates that a source is bad by setting it to null.
 *    Why? Because failure is the common case.
 *
 *    Sources with valid-seeming but unknown fingerprints pass
 *    through unbotherd.
 */
function normalize(source, cb) {
  if (!source.type && (source.id || source.url)) return bail(source, cb)
  if (source.id) source.id = String(source.id)
  if (!_sources[source.type]) source.hidden = true  // pass through but don't display
  if (norm[source.type]) norm[source.type](source, cb)
  else cb(source)
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
    return cb(source)
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
  cb(source)
}

module.exports = normalize
