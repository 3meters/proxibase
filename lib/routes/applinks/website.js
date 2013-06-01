/**
 * applinks/website.js
 *
 *  Grovel a website for hyperlinks to known applinks
 */

var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var url = require('url')
var thumbnail = require('./thumbnail')
var _applinks = util.statics.applinks
var thumbDir = '../../../assets/img/thumbnails'


function normalize(applink) {

  if (!applink) return applink = null
  if (applink.id && !applink.url) {
    applink.url = applink.id
  }
  var urlObj = url.parse(applink.url)
  applink.url = url.format(urlObj)
  if (!/^http/.test(applink.url)) applink.url = 'http://' + applink.url
  applink.id = applink.url
  return
}


// Get the web page and grovel it for links to known applinks
function get(applink, scope, cb) {

  if (!(applink && applink.id)) {
    return cb(perr.badApplink(applink))
  }

  var reqOps = {uri: applink.id}

  // Our tests call our server to deliver some static pages
  // turning off strictSSL allows us to accept pages from
  // a server with a self-signed cert
  reqOps.strictSSL = (util.config.service.mode === 'test')
    ? false
    : true

  request.get(reqOps, function(err, res) {
    if (err) return cb(err)
    if (_.isEmpty(res.body)) {
      return cb(perr.badApplink('Received no data for ', applink.id, res.headers))
    }
    applink.data.validated = util.now()

    // Fire and forget the thumbnail generator
    thumbnail.get(applink, scope.user, res)

    // Set the thumbnail url optimistically
    applink.photo = {
      prefix: thumbnail.getFileName(applink),
      sourceName: 'aircandi'
    }

    var urlObj = url.parse(applink.id)
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
            originId: applink.id
          }
        })
        return
      }
      for (var _applink in _applinks) {
        // Match if url hostname begins with a known applink
        if (urlObj.host && urlObj.host.indexOf(_applink) >= 0) {
          candidates.push({
            type: _applink,
            url: urlObj.href,
            data: {
              origin: 'website',
              originId: applink.id,
            }
          })
        }
      }
    })

    if (scope.raw) scope.raw.webSiteCandidates = candidates
    candidates.forEach(function(candidate) {
      scope.applinkQ.push(candidate)
    })

    cb(null, applink)
  })
}

exports.normalize = normalize
exports.get = get
