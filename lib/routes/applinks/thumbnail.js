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

var fs = require('fs')
var path = require('path')
var url2png = require('url2png')('P51829DA6A53F5', 'S12AD53257E578')
var nodeUrl = require('url')
var request = util.request
var knox = require('knox')    // TJ's aws lib
var thumbDir = path.join(__dirname, '../../../assets/img/thumbnails')


// Main worker
function get(applink, scope, cb) {

  var timeout = scope.timeout || statics.timeout
  if (scope.log) log('thumbnail called for ', applink)

  // Callback is optional: May be fire and forget
  if (!tipe.isFunction(cb)) {
    cb = function(err, results) {
      if (scope.log) log('Thumbnail called without callback for ' + applink.appId)
      if (err) return logErr('Error generating thumbnail for applink ' + applink.appId, err.stack||err)
      else log('Thumbnail generation finished for applink ' + applink.appId, (results) ? results : '')
    }
    timeout*= 10  // no callback no hurry
  }

  if ('test' === util.config.service.mode && !scope.testThumbnails) {
    log('Test mode: skipping thumbnail generation')
    return cb(null)
  }

  var fileName = getFileName(applink)

  // Start the clock
  var timer = util.timer()
  log('Starting thumbnail generation for ' + applink.appId)

  var u2pOps = {
    protocol: 'http',
    viewport: '1280x1280',
    thumbnail_max_width: 200,
  }

  var u2pURL = url2png.buildURL(applink.appUrl, u2pOps)
  var ops = {uri: u2pURL, log: scope.log, provider: 'u2p'}

  // set up closure for util.timeLimit
  function makeCall(cb) {
    callThumbnailService(applink, ops, cb)
  }

  util.timeLimit(makeCall, timeout, cb)

  function callThumbnailService(applink, ops, cb) {
    if (ops.log) log('Calling thumbnail service with options', ops)
    var req = request.get(ops.uri)
    if (ops.query) req.query(ops.query)
    req.end(function(err, res) {
      if (ops.log) {
        log(ops.provider + ' thumbnail service complete for ' +
            applink.appId + ' after ' + timer.read())
      }
      var corpse = {
        applink: applink,
        options: ops,
        error: err,
        text: res.text
      }
      if (err) return cb(perr.partnerError('Thumbnail service', corpse))
      if ((res.headers['content-type'].indexOf('image') < 0) &&
          (parseInt(res.headers['content-length']))) {
        return cb(perr.partnerError('Thumbnail service returned no image', corpse))
      }

      if (ops.log) log('Saving ' + fileName + ' to assets')
      // Save the image to our static folder
      var filePath = path.join(thumbDir, fileName)
      var ws = fs.createWriteStream(filePath)
      res.pipe(ws)
      ws.on('error', cb)

      // When finished upload a backup copy to S3
      ws.on('finish', function() { uploadToS3(filePath, fileName, ops, cb) })
    })
  }

  function uploadToS3(filePath, fileName, ops, cb) {
    if (ops.log) log('Uploading thumbnail to S3 after ' + timer.read())

    var s3 = knox.createClient({
      key: 'AKIAIYU2FPHC2AOUG3CA',
      secret: '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',
      region: 'us-west-2',
      bucket: 'aircandi-images',
    })

    var headers = {'x-amz-acl': 'public-read'}

    s3.putFile(filePath, fileName, headers, function(err, s3Res) {
      if (ops.log) log('S3 thumbnail upload complete after ' + timer.read())
      if (err) return cb(perr.partnerError('S3', err))
      if (200 === s3Res.statusCode) return cb(null)
      else {
        cb(perr.partnerError('Amazon S3 returned error code ' + s3Res.statusCode))
        s3Res.pipe(process.stderr) // can log accept streams?
      }
    })
  }
}


// Make the thumbnail file name from the website url.
// Exported and scynchronous so that applink process can
// construct a url for the thumbnail before the image
// has been created.
function getFileName(applink) {
  var urlObj = nodeUrl.parse(applink.appUrl ? applink.appUrl : applink.appId)
  var fileName = urlObj.host + urlObj.path
  // replace non-word chars and underscores in the url with dots
  fileName = fileName.replace(/\W|\_/g, '.')
  return fileName += (/\.$/.test(fileName)) ? 'png' : '.png'
}



exports.get = get
exports.getFileName = getFileName
