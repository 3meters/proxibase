/**
 * sources/website.js
 *
 *  Grovel a website for hyperlinks to known sources
 */

var request = require('request')
var cheerio = require('cheerio')
var url = require('url')
var thumbnail = require('./thumbnail')
var _sources = util.statics.sources


function normalize(source) {

  if (source.id && !source.url) {
    source.url = source.id
  }
  source.url = url.format(url.parse(source.url))
  if (source.url.indexOf('http') !== 0) source.url = 'http://' + source.url
  source.id = source.url
  return source
}


function get(source, scope, cb) {

  var grovelFinished = false
  var thumbNailFinished = false
  var sent = false

  // Kick off the thumbnail processor
  thumbnail.get(source.id, scope.user._id, finish)

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
      return finish(perr.badSource('Received no data for ', source.id, res.headers),
          null, 'grovel')
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

    finish(null, source, 'grovel')
  })

  function finish(err, data, task) {
    if (sent) return
    if (err) {
      sent = true
      return cb(err)
    }
    if (task === 'grovel') grovelFinished = true
    if (task === 'thumbnail') {
      thumbnailFinished = true
      source.photo = data
    }
    if (grovelFinished && thumbnailFinished) {
      sent = true
      cb(null, source)
    }
  }
}


exports.normalize = normalize
exports.get = get
