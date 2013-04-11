/**
 * suggest/thumb.js
 *
 *    get a thumbnail image of a website
 *    store it on s3
 *    set the picture property of the source to our saved image
 */

var url2png = require('url2png')
var nodeUrl = require('url')
var fs = require('fs')
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

function get(url, cb) {

  try { nodeUrl.parse(url) }
  catch (e) { return cb(perr.badValue(url)) }

  var timer = util.Timer()
  var ops = {}

  var useBlu = false
  if (useBlu) {
    var thumb = blu
    var d = new Date()
    var y = String(d.getUTCFullYear())
    var m = d.getUTCMonth() + 1
    m = m < 10 ? '0' + m : String(m)
    var d = d.getUTCDate()
    d = d < 10 ? '0' + d : String(d)
    var yyyymmdd =  y + m + d
    log('debug ' + yyyymmdd + url + thumb.key)
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
      query: {url: 
      log: true,
    }
  }

  // var ws = fs.createWriteStream(__dirname + '/thumb.jpeg')

  ops.uri = thumb.service + '/' + ops.path
  var req = request
    .get(ops.uri)
    .query(ops.query)
    .end(function (err, res) {
      if (err) return cb(err)
      log('Thumbnail service response time: ' + timer.read())
      log('debug res.headers:', res.headers)
      if (res.headers.content-type.indexOf('image') >= 0 &&
          parseInt(res.headers.content-length))
      // get the picture file itself, upload it to s3, get back its url and return a photo object
      cb(null, res, body)
    })
}

