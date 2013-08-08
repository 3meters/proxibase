/**
 * suggest/thumb.js
 *
 *    get:
 *    Get a thumbnail image of a website.
 *    Store in in our own thumbnails folder for serving as
 *    as static file.
 *    Store a backup on s3
 *
 *    getFileName:
 *    Synchronously generate the filename of the thumbnail image
 *    that eventually we will create.
 *
 */

var crypto = require('crypto')
var fs = require('fs')
var path = require('path')
var moment = require('moment')
var url2png = require('url2png')('P51829DA6A53F5', 'S12AD53257E578')
var nodeUrl = require('url')
var request = util.request
var knox = require('knox')    // TJ's aws lib
var thumbDir = path.join(__dirname, '../../../assets/img/thumbnails')
var useBlu = false
var useU2p = true


// Bluga is the thumbnail provider who narrowly lost the bake-off to
// url2png. Leaving in the code in case we ever need to switch quickly.
var blu = {
  web: 'http://webthumb.bluga.net',
  user: 'api@3meters.com',
  pw: 'standard',
  service: 'http://webthumb.bluga.net',
  path: 'easythumb.php',
  userid: '71263',
  key: 'ca1562ac9d9f5e5aff4ed661dbf18234',
}


// url2png: our current thumbnail provider
var u2p = {
  web: 'http://url2png.com',
  service: 'http://beta.url2png.com',
  path: 'v6',
  key: 'P51829DA6A53F5',
  secret: 'SEC8F5BFE342E6',
}


// Make the thumbnail file name from the website url.
// Exported and scynchronous so that applink process can
// construct a url for the thumbnail before the image
// has been created.
function getFileName(applink) {
  var urlObj = nodeUrl.parse(applink.appId)
  var fileName = urlObj.host + urlObj.path
  fileName = fileName.replace(/\//g, '.')  // change slashes to dots
  return fileName += (/\.$/.test(fileName)) ? 'png' : '.png'
}


// Main worker
function get(applink, user, res, cb) {

  // Currently fire and forget from the caller
  cb = cb || function(err, applink) {
    if (err) return logErr(err)
    if (applink) log('Thumbnail completed for applink: ', applink)
  }

  if (applink.data.skipThumbnail) return cb()

  if (util.config.service.mode === 'test'
      && !util.config.testThumbnails)  return cb()

  var fileName = getFileName(applink)

  // Start the clock
  var timer = util.Timer()
  log('Starting thumbnail generation')

  if (useBlu) {
    var thumb = blu
    yyyymmdd = moment().utc().format('YYYYMMDD')
    var hash = crypto.createHash('md5').update(yyyymmdd + url + thumb.key, 'utf8').digest('hex')
    ops = {
      uri: thumb.service + '/' + thumb.path,
      query: {
        url: encodeURI(url),
        user: thumb.userid,
        size: 'medium2',
        output_type: 'png',   // doesn't work, returns jpegs
        cache: 1,
        hash: hash,
      },
      log: true,
      provider: 'blu'
    }
    callThumbnailService(ops)
  }

  if (useU2p) {
    // TODO:  review these params with jay
    var u2pURL = url2png.buildURL(applink.appId, {
      protocol: 'http',
      viewport: '1280x1280',
      thumbnail_max_width: 200,
    })
    ops = {uri: u2pURL, log: true, provider: 'u2p'}
    callThumbnailService(ops)
  }

  function callThumbnailService(ops) {
    if (ops.log) log('Calling thumbnail service with options', ops)
    var req = request.get(ops.uri)
    if (ops.query) req.query(ops.query)
    req.end(function(err, res) {
      log(ops.provider + ' thumbnail service response time: ' +
        timer.read() + ' for:', ops.query)
      var corpse = {
        options: ops,
        error: err,
        text: res.text
      }
      if (err) return cb(perr.partnerError('Thumbnail service', corpse))
      if (!(res.headers['content-type'].indexOf('image') >= 0) &&
          (parseInt(res.headers['content-length']))) {
        return cb(perr.partnerError('Thumbnail service returned no image', corpse))
      }

      // Save the image to our static folder
      var filePath = path.join(thumbDir, fileName)
      var ws = fs.createWriteStream(filePath)
      res.pipe(ws)
      ws.on('error', cb)

      // When finished upload a backup copy to S3
      ws.on('close', function() { uploadToS3(filePath, fileName) })
    })
  }

  function uploadToS3(filePath, FileName) {
    log('Uploading thumbnail to S3 after ' + timer.read())

    var s3 = knox.createClient({
      key: 'AKIAIYU2FPHC2AOUG3CA',
      secret: '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',
      region: 'us-west-2',
      bucket: 'aircandi-images',
    })

    var headers = {'x-amz-acl': 'public-read'}

    s3.putFile(filePath, fileName, headers, function(err, s3Res) {
      log('S3 thumbnail upload complete after ' + timer.read())
      if (err) return cb(perr.partnerError('S3', err))
      if (200 === s3Res.statusCode) return cb(null, applink)
      else {
        cb(perr.partnerError('Amazon S3 returned error code ' + s3Res.statusCode))
        s3Res.pipe(process.stderr) // can log accept streams?
      }
    })
  }
}
exports.get = get
exports.getFileName = getFileName
