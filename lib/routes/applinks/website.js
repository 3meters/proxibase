/**
 * applinks/website.js
 *
 *  Grovel a website for hyperlinks to known applinks
 */

var request = require('request')
var cheerio = require('cheerio')
var url = require('url')
var apps = require('./').apps
var thumbnail = require('./thumbnail')


function normalize(applink) {
  if (!applink) return null
  var id = applink.appId || applink.appUrl
  if (!tipe.isString(id)) return null
  var urlObj = url.parse(id)
  if (!urlObj.protocol) urlObj = url.parse('http://' + id)
  if (!(urlObj.protocol && urlObj.host)) return null
  if (2 == urlObj.host.split('.').length) urlObj.host = 'www.' + urlObj.host
  // trim trailing slashs and elements beginning default or index
  id = url.format(urlObj).replace(/\/$/, '')
  var elems = id.split('/')
  var last = elems[elems.length -1]
  if (/^default\./.test(last) || /^index\./.test(last)) {
    elems.pop()
    id = elems.join('/')
  }
  applink.appUrl = applink.appId = id
  return applink
}


// Get the web page and grovel it for links to known applinks
function get(applink, scope, cb) {

  if (!(applink && applink.appId)) {
    return cb(perr.badApplink(applink))
  }

  var reqOps = {uri: applink.appId}

  // Our tests call our server to deliver some static pages
  // turning off strictSSL allows us to accept pages from
  // a server with a self-signed cert
  reqOps.strictSSL = (util.config.service.mode === 'test')
    ? false
    : true

  util.timeLimit(getWebPage, scope.timeout, processWebPage)

  function getWebPage(cb) {
    request.get(reqOps, cb)
  }

  function processWebPage(err, res, body) {
    if (err) return cb(err)
    if ((res.statusCode >= 400) || (_.isEmpty(body))) {
      if ('aircandi' === applink.origin) {
        applink.validatedDate = -1
        return cb(null, applink)
      }
      else return cb(perr.badApplink(applink.appId, {
        statusCode: res.statusCode,
           headers: res.headers,
      }), null)
    }
    applink.validatedDate = util.now()

    getThumbnail()

    function getThumbnail() {

      // Set the thumbnail url optimistically
      if (!applink.photo) {
        applink.photo = {
          prefix: thumbnail.getFileName(applink),
          source: 'aircandi.thumbnails'
        }
      }

      // call thumbnail generation service
      if (scope.waitForContent) {
        thumbnail.get(applink, scope, function(err) {
          if (err) return cb(err)
          grovelPage()
        })
      }
      else {
        thumbnail.get(applink, scope) // fire and forget
        grovelPage()
      }
    }


    function grovelPage() {

      if (scope.refreshOnly) return cb(null, applink)

      var candidates = []

      var $ = cheerio.load(res.body)  // Cheerio is an implementation of the jquery core DOM
      var title = $('title').text()
      if (!applink.name) {  // Issue 161
        if (title) applink.name = title
        else applink.name = applink.appUrl
      }

      $('a').each(function() {
        var href = $(this).attr('href')
        if (!href) return
        var urlObj = url.parse(href)
        if (!urlObj) return
        if (urlObj.protocol && urlObj.auth && urlObj.hostname
            && urlObj.protocol.indexOf('mailto:') === 0) {
          candidates.push({
            type: 'email',
            appId: urlObj.auth + '@' + urlObj.hostname,
            origin: 'website',
            originId: applink.appId
          })
          return
        }
        for (var key in apps) {
          if (apps[key].system) continue
          // Match if url hostname begins with a known applink
          // Don't accept links back to the referring origin
          if (urlObj.host && (urlObj.host.indexOf(key) >= 0) && (key !== applink.origin)) {
            candidates.push({
              type: key,
              appUrl: urlObj.href,
              origin: 'website',
              originId: applink.appId,
            })
          }
        }
      })

      if (scope.raw) {
        scope.raw.website = scope.raw.website || {}
        scope.raw.website[applink.appId] = candidates
      }
      candidates.forEach(function(candidate) {
        scope.applinkQ.push(candidate)
      })

      cb(null, applink)
    } // grovelPage
  }
}

exports.normalize = normalize
exports.get = get
