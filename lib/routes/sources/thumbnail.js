/**
 * suggest/thumb.js
 *
 *    get a thumbnail image of a website
 *    store it on s3
 *    set the picture property of the source to our saved image
 */

var crypto = require('crypto')
var fs = require('fs')
var path = require('path')
var AWS = require('aws-sdk')
var moment = require('moment')
var url2png = require('url2png')('P5180054734736', 'SB0757D35C5907')
var nodeUrl = require('url')
var request = util.request
var knox = require('knox')
var thumbDir = path.join(__dirname, '../../../assets/img/thumbnails')
var useBlu = false
var useU2p = true

var blu = {
  web: 'http://webthumb.bluga.net',
  user: 'api@3meters.com',
  pw: 'standard',
  service: 'http://webthumb.bluga.net',
  path: 'easythumb.php',
  userid: '71263',
  key: 'ca1562ac9d9f5e5aff4ed661dbf18234',
}

var u2p = {
  web: 'http://url2png.com',
  service: 'http://beta.url2png.com',
  path: 'v6',
  key: 'P5165A11D417E0',
  secret: 'SEC8F5BFE342E6',
}

function get(source, user, res, cb) {

  cb = cb || function(err, source) {
    if (err) return logErr('Error generating thumbnail', err)
    if (source) log('Thumbnail completed for source: ', source)
  }

  if (source.data.skipThumbnail) return cb()

  // Validate url
  var url = source.id
  try { nodeUrl.parse(url) }
  catch (e) { return cb(perr.badValue(url)) }

  // Start the clock
  var timer = util.Timer()
  log('Starting thumbnail: ', timer.read())

  // Generate the base file name
  var urlObj = nodeUrl.parse(url)
  var fileName = urlObj.host + urlObj.path
  if (/\/$/.test(fileName)) fileName = fileName.slice(0, -1) // trim trailing slash
  var filePath = ''


  var ops = {}

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
        output_type: 'png',
        cache: 1,
        hash: hash,
      },
      log: true,
      provider: 'blu'
    }
    callThumbnailService(ops)
  }

  if (useU2p) {
    var u2pURL = url2png.buildURL(source.id, {
      protocol: 'http',
      viewport: '1280x720',
      thumbnail_max_width: 320
    })
    ops = {uri: u2pURL, log: true, provider: 'u2p'}
    callThumbnailService(ops)
  }

  function callThumbnailService(ops) {
    var req = request.get(ops.uri)
    if (ops.query) req.query = ops.query
    req.end(function(err, res) {
        log(ops.provider + ' thumbnail service response time: ' + timer.read())
        if (err) return cb(err)
        log(res.headers)
        if (!(res.headers['content-type'].indexOf('image') >= 0) &&
            (parseInt(res.headers['content-length']))) {
          return cb(perr.serverError('thumbnail service returned no data'))
        }

        var filePath = path.join(thumbDir, fileName + '.' + ops.provider + '.png')
        var ws = fs.createWriteStream(filePath)
        res.pipe(ws)
        ws.on('error', cb)
        ws.on('close', function() { uploadToS3(filePath, fileName) })
      })
  }

  function uploadToS3(filePath, FileName) {
    log('Uploading thumbnail to S3 after ' + timer.read())

    var s3 = knox.createClient({
      key: 'AKIAIYU2FPHC2AOUG3CA',
      secret: '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',
      region: 'us-west-2',
      bucket: 'aircandi-thumbnails',
    })

    var headers = {'x-amz-acl': 'public-read'}

    s3.putFile(filePath, fileName, headers, function(err, s3Res) {
      log('S3 thumbnail upload complete after ' + timer.read())
      if (err) return cb(err)
      if (200 === s3Res.statusCode) return cb(null, source)
      else {
        cb(perr.partnerError('Amazon S3 returned error code ' + s3Res.statusCode))
        s3Res.pipe(process.stderr) // can log accept streams?
      }
    })
  }
}
exports.get = get
