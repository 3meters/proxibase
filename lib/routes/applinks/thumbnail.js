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

  // TODO: remove. logging in order to diagnose issue 164 in producion
  scope.log = true

  if (scope.log) log('thumbnail called for ', applink)
  var timeout = scope.timeout || util.statics.timeout

  // Callback is optional: May be fire and forget
  if (!tipe.isFunction(cb)) {
    cb = function(err, results) {
      if (scope.log) log('Get thumbnail returned, no cb: ' + applink.appId, (results) ? results : '')
      if (err) return logErr('Error generating thumbnail for applink ' + applink.appId, err.stack||err)
    }
    timeout*= 10  // no callback no hurry
  }

  if ('test' === util.config.service.mode && !scope.testThumbnails) {
    log('Test mode: skipping thumbnail generation')
    return cb()
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
  var ops = {uri: u2pURL, log: scope.log}

  var corpse = {
    applink: applink,
    options: ops,
  }

  if (ops.log) log('Calling thumbnail service ', corpse)

  var req = request.get(ops.uri)
  req.timeout(timeout)

  if (ops.query) req.query(ops.query)
  req.on('error', fail)

  // Save the image to our static folder
  var filePath = path.join(thumbDir, fileName)
  req.pipe(fs.createWriteStream(filePath))
    .on('error', fail)
    .on('finish', haveThumbnail)

  // Puke
  function fail(err) {
    corpse.error = err
    logErr('Error fetching or writing thumbnail', corpse)
    return cb(err)
  }

  // When finished upload a backup copy to S3
  function haveThumbnail() {
    if (ops.log) log('Thumbnail returned for ' + applink.appId + ' in ' + timer.read())
    fs.stat(filePath, function(err, stats) {
      if (err) return fail(err)
      if (!stats.size) return fail(perr.partnerError('Thumbnail is an empty file'))
      uploadToS3(filePath, fileName, ops, cb)
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
      // TODO: delete temp file
      if (200 === s3Res.statusCode) return cb(null)
      else {
        cb(perr.partnerError('Amazon S3 returned error code ' + s3Res.statusCode))
        s3Res.pipe(process.stderr) // can log accept streams?
      }
    })
  }
}


// Make the thumbnail file name from the website url (sans query string).
// Exported and scynchronous so that the applink process can construct the
// name before the creating the thumbnail.
function getFileName(applink) {
  var urlObj = nodeUrl.parse(applink.appUrl ? applink.appUrl : applink.appId)
  var fileName = urlObj.host + urlObj.pathname
  // replace non-word chars and underscores in the url with dots
  fileName = fileName.replace(/\W|\_/g, '.')
  return fileName += (/\.$/.test(fileName)) ? 'png' : '.png'
}


exports.get = get
exports.getFileName = getFileName
