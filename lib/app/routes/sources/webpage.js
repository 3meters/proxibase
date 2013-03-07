/**
 * sources/webpage.js
 *
 *  Grovel a web page for hyperlinks to known sources
 */

var superagent = require('superagent')
var cheerio = require('cheerio')
var url = require('url')
var normalize = require('./normalize')
var _sources = util.statics.sources

function grovelWebPage(options, cb) {
  var newSources = options.newSources
  var raw = options.raw
  var query = options.query

  superagent.get(query.uri).end(function(err, sres) {
    if (err) { logErr(err.stack || err); return cb() }
    if (!sres.text) return cb()

    var candidates = []

    var $ = cheerio.load(sres.text)  // Cheerio is an implementation of the jquery core DOM
    $('a').each(function(i, elm) {
      var href = $(this).attr('href')
      if (!href) return
      var urlObj = url.parse(href)
      if (!urlObj) return
      if (urlObj.protocol && urlObj.protocol.indexOf('mailto:') === 0) {
        var id = urlObj.auth + '@' + urlObj.hostname
        candidates.push({
          type: 'email',
          id: id,
          data: {
            origin: 'website',
            originUrl: query.uri
          }
        })
        return
      }
      for (var _source in _sources) {
        // Match if url hostname begins with a known source
        if (urlObj.host && urlObj.host.indexOf(_source) >= 0) {
          candidates.push({
            type: _source,
            url: urlObj.href,
            data: {
              origin: 'website',
              originUrl: query.uri
            }
          })
        }
      }
    })
    if (raw) raw.webPageCandidates = candidates

    // Normally we would use async.each for this, but we want
    // to accumulate results incrementally, rather than batched
    // at the end, since the whole process is subject to a timeout
    var returned = 0
    candidates.forEach(function(candidate) {
      normalize(candidate, function(err, source) {
        if (err) return cb(err)
        if (source) newSources.push(source)
        if (++returned >= candidates.length) return cb()
      })
    })
  })
}

exports.grovel = grovelWebPage
