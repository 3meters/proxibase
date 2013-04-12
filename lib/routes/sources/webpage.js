/**
 * sources/webpage.js
 *
 *  Grovel a web page for hyperlinks to known sources
 */

var request = require('request')
var cheerio = require('cheerio')
var url = require('url')
var normalize = require('./normalize')
var _sources = util.statics.sources

function inspect(options, cb) {
  var sources = options.sources
  var sourceMap = options.sourceMap
  var raw = options.raw
  var query = options.query
  var reqOps = {uri: query.uri}

  // Our tests call our server to deliver some static pages
  // turning off strictSSL allows us to accept pages from
  // a server with a self-signed cert
  reqOps.strictSSL = (util.config.service.mode === 'test')
    ? false
    : true

  request.get(reqOps, function(err, res) {
    if (err) { logErr(err.stack || err); return cb() }
    if (_.isEmpty(res.body)) {
      logErr('Received no data for ' + query.uri)
      logErr(res.headers)
      return cb()
    }

    var candidates = []

    var $ = cheerio.load(res.body)  // Cheerio is an implementation of the jquery core DOM
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
        if (source && !sourceMap[source.type + source.id]) sources.push(source)
        if (++returned >= candidates.length) return cb()
      })
    })
  })
}

exports.inspect = inspect
