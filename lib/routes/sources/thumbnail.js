/**
 * suggest/thumb.js
 *
 *    get a thumbnail image of a website
 *    store it on s3
 *    set the picture property of the source to our saved image
 */

var crypto = require('crypto')
var fs = require('fs')
var aws = require('aws-sdk')
var moment = require('moment')
var url2png = require('url2png')
var nodeUrl = require('url')
var tee = require('tee-1')
var request = util.request

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

  var ws = fs.createWriteStream(__dirname + '/thumb.jpeg')

  ops.uri = thumb.service + '/' + ops.path
  var req = request
    .get(ops.uri)
    .query(ops.query)
    .end(function(err, res) {
      log('Thumbnail service response time: ' + timer.read())
      if (err) return cb(err)
      log(res.headers)
      if (res.headers['content-type'].indexOf('image') >= 0 &&
          parseInt(res.headers['content-length'])) {
        // get the picture file itself, upload it to s3,
        // get back its url and return a photo object
        res.pipe(ws)
      }
    })

  ws.on('error', function(err) { cb(err) })

  ws.on('finish', function() {
    cb(null, { prefix: 'my_s3_url.jpeg' })
  })

  function putPhoto(photoStream, cb) {
    aws.config.update({
      accessKeyId: 'AKIAIYU2FPHC2AOUG3CA',
      secretAccessKey: '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',
    })
    var s3Bucket = new aws.S3({params: {Bucket: 'aircandi-images'}})
    var key = ''
  }

}
exports.get = get

