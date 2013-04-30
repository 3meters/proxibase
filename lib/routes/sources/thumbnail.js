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

  cb = cb || function(err, source) {
    if (err) return logErr('Error generating thumbnail', err)
    if (source) log('Thumbnail completed for source: ', source)
  }

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
      uri: thumb.service + '/' + thumb.path,
      query: {
        url: encodeURI(url),
        user: thumb.userid,
        size: 'large',
        output_type: 'png',
        cache: 1,
        hash: hash,
      },
      log: true,
    }
  }
  else {
    /*
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
    */
    // Building the url with a module
    var u2pURL = url2png.buildURL(source.id, {protocol: 'https'})
    log('u2pURL: ' + u2pURL)
    ops = {uri: u2pURL}
  }


  var fileName, filePath
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
      fileName += '.png'
      filePath = path.join(__dirname, thumbDir, fileName)
      log('debug filePath: ' + filePath)
      var ws = fs.createWriteStream(filePath)
      res.pipe(ws)
      ws.on('error', cb)
      ws.on('close', uploadToS3)
    })

    function uploadToS3() {
      log('debug start upload to S3 after ' + timer.read())

      var s3 = knox.createClient({
        key: 'AKIAIYU2FPHC2AOUG3CA',
        secret: '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',
        region: 'us-west-2',
        bucket: 'aircandi-thumbnails',
      })

      var headers = {'x-amz-acl': 'public-read'}

      s3.putFile(filePath, fileName, headers, function(err, s3Res) {
        log('debug S3 upload returned after ' + timer.read())
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
