/**
 * sources/website.js
 *
 *  Grovel a website for hyperlinks to known sources
 */

var request = require('request')
var cheerio = require('cheerio')
var url = require('url')
var _sources = util.statics.sources


function normalize(source) {

  if (source.id && !source.url) {
    source.url = source.id
  }
  var urlObj = url.parse(source.url)
  urlObj.protocol = urlObj.protocol || 'http:'
  source.id = source.url = url.format(urlObj)
  return source
}


function get(source, scope, cb) {

  var reqOps = {uri: source.id}

  // Our tests call our server to deliver some static pages
  // turning off strictSSL allows us to accept pages from
  // a server with a self-signed cert
  reqOps.strictSSL = (util.config.service.mode === 'test')
    ? false
    : true

  request.get(reqOps, function(err, res) {
    if (err) return cb(err)
    if (_.isEmpty(res.body)) {
      return cb(perr.badSource('Received no data for ', source.id), res.headers)
    }
    source.data.validated = util.now()

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
            originId: source.id
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
              originId: source.id,
            }
          })
        }
      }
    })

    if (scope.raw) scope.raw.webSiteCandidates = candidates
    candidates.forEach(function(candidate) {
      scope.sourceQ.push(candidate)
    })

    cb(null, source)
  })
}

exports.normalize = normalize
exports.get = get