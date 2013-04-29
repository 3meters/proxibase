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
var url2png = require('url2png')
var nodeUrl = require('url')
var tee = require('tee-1')
var request = util.request
var knox = require('knox')
var thumbDir = '../../../assets/img/thumbnails'

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

function get(source, user, cb) {

  if (source.data.skipThumbnail) {
    return cb()
  }
  var url = source.id

  try { nodeUrl.parse(url) }
  catch (e) { return cb(perr.badValue(url)) }

  var timer = util.Timer()
  var ops = {}

  var useBlu = true
  if (useBlu) {
    var thumb = blu
    yyyymmdd = moment().utc().format('YYYYMMDD')
    var hash = crypto.createHash('md5').update(yyyymmdd + url + thumb.key, 'utf8').digest('hex')

    ops = {
      path: thumb.path,
      query: {
        url: encodeURI(url),
        user: thumb.userid,
        size: 'medium',
        cache: 1,
        hash: hash,
      },
      log: true,
    }
  }
  else {
    var thumb = u2p
    var qs = encodeURI('?url=' + url)
    var qs = '?url' + encodeURI('http://www.google.com')
    var encoding = 'utf8'  // have tried 'ascii' and 'binary' with same results
    var token = crypto.createHash('md5').update(qs + thumb.secret, encoding).digest('hex')
    ops = {
      path: thumb.path + '/' + thumb.key + '/' + token + '/png',
      query: {url: 'TODO'},
      log: true,
    }
  }


  var fileName, filePath
  // Ask our thumbnail service for an image
  ops.uri = thumb.service + '/' + ops.path
  var req = request
    .get(ops.uri)
    .query(ops.query)
    .end(function(err, res) {
      log('Thumbnail service response time: ' + timer.read())
      if (err) return cb(err)
      log(res.headers)
      if (!(res.headers['content-type'].indexOf('image') >= 0) &&
          (parseInt(res.headers['content-length']))) {
        return cb(perr.serverError('thumbnail service returned no data'))
      }

      var urlObj = nodeUrl.parse(source.id)
      fileName = urlObj.host + urlObj.path
      if (/\/$/.test(fileName)) fileName = fileName.slice(0, -1) // trim trailing slash
      fileName += '.jpg'
      log('fileName: ' + fileName)
      filePath = path.join(__dirname, thumbDir, fileName)
      log('filePath: ' + filePath)
      var ws = fs.createWriteStream(filePath)
      res.pipe(ws)
      ws.on('error', function(err) {log('save tmp file failed'); return cb(err)})
      ws.on('close', uploadToS3)
    })

    function uploadToS3() {
      log('Startup upload to S3 after ' + timer.read())

      // We have a thumnail, upload it to s3
      var s3 = knox.createClient({
        key: 'AKIAIYU2FPHC2AOUG3CA',
        secret: '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',
        region: 'us-west-2',
        bucket: 'aircandi-thumbnails',
      })

      var headers = {
        //'Content-Length': res.headers['content-length'],
        //'Content-Type': res.headers['content-type'],
        'x-amz-acl': 'public-read',
      }
      log('s3 headers: ', headers)

      s3.putFile(filePath, fileName, headers, function(err, s3Res) {
        if (err) return cb(err)
        s3Res.pipe(process.stdout)
        cb(null)
      })

    }

    /*
    s3Req.on('error', function(err) { log('debug s3 choked'); cb(err) })

    // Safely uploaded to s3, return the photo url to the source 
    s3Req.on('response', function(s3Res) {
      if (s3Res.statusCode !== 200) {
        log('s3 Error: ', s3Res.Error)
        log('s3 error: ', s3Res.error)
        log('s3 body: ', s3Res.body)
        s3Res.pipe(process.stdout)
        return cb(perr.serverError('Error saving thumbnail to s3 with code ' +
            s3Res.statusCode, s3Res.body))
      }
      var photo = {
        prefix: s3.http(key),
        sourceName: 'website'
      }
      cb(null, photo)
    })
    */

}
exports.get = get
