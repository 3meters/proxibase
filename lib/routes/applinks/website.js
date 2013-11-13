/**
 * applinks/website.js
 *
 *  Grovel a website for hyperlinks to known applinks
 */

var request = require('request')
var cheerio = require('cheerio')
var async = require('async')
var url = require('url')
var apps = require('./').apps
var thumbnail = require('./thumbnail')
var thumbDir = '../../../assets/img/thumbnails'


function normalize(applink) {

  if (!applink) return null
  if (applink.appId && !applink.appUrl) {
    applink.appUrl = applink.appId
  }
  if (!tipe.isString(applink.appUrl)) return null
  var urlObj = url.parse(applink.appUrl)
  applink.appUrl = url.format(urlObj)
  if (!/^http/.test(applink.appUrl)) applink.appUrl = 'http://' + applink.appUrl
  applink.appId = applink.appUrl
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

  request.get(reqOps, function(err, res, body) {
    if (err) return cb(err)
    if (_.isEmpty(body)) {
      return cb(perr.badApplink(
          'Received no data for ', applink.appId, res.headers), null)
    }
    applink.data.validated = util.now()

    getThumbnail()

    function getThumbnail() {

      // Set the thumbnail url optimistically
      if (!applink.photo) {
        applink.photo = {
          prefix: thumbnail.getFileName(applink),
          source: 'aircandi'
        }
      }

      // call thumbnail generation service
      if (scope.waitForContent) {
        thumbnail.get(applink, scope, function(err) {
          if (err) logErr('Error in thumbnail generation service for ' + applink.appId, err)
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

      var urlObj = url.parse(applink.appId)
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
            schema: util.statics.schemaApplink,
            appId: id,
            data: {
              origin: 'website',
              originId: applink.appId
            }
          })
          return
        }
        for (var key in apps) {
          // Match if url hostname begins with a known applink
          if (urlObj.host && urlObj.host.indexOf(key) >= 0) {
            candidates.push({
              type: key,
              schema: util.statics.schemaApplink,
              appUrl: urlObj.href,
              data: {
                origin: 'website',
                originId: applink.appId,
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
    } // grovelPage
  })
}

exports.normalize = normalize
exports.get = get
