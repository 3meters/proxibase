/**
 * get foursquare categories images and load them into the file tree
 */

var util = require('../../lib/utils')   // load proxibase util extensions
var call = util.callService.foursquare
var request = require('request')
var fs = require('fs')
var async = require('async')
var path = require('path')
var dir = '../../assets/img/categories/foursquare'
var icons = []
var sizes = ['88', 'bg_88']


function start() {
  // Blow away all files in dir
  var fileNames = fs.readdirSync(dir)
  fileNames.forEach(function(fileName) {
    fs.unlinkSync(path.join(dir, fileName))
  })
  getIconUris()
}


function getIconUris() {
  call({path: 'categories', logReq: true}, function(err, res) {
    if (err) throw err
    parse(res.body.response.categories)
    log('writing ' + icons.length + ' icons: ')
    async.forEach(icons, getIcon, finish)
  })
}


function parse(categories) {
  categories.forEach(function(category) {
    if (category.categories) parse(category.categories) // recurse
    sizes.forEach(function(size) {
      icons.push({
        id: category.id,
        size: size,
        suffix: category.icon.suffix,
        uri: category.icon.prefix + size + category.icon.suffix
      })
    })
  })
}

function getIcon(icon, cb) {
  var fileName = icon.id + '_' + icon.size + icon.suffix
  request.get(icon.uri)
    .pipe(fs.createWriteStream(path.join(dir, fileName))
      .on('error', function(err) {
        return cb(err)
      })
      .on('close', function() {
        log(fileName)
        return cb()
      })
    )
}

function finish(err) {
  if (err) throw err
  log('finished ok')
}

start()
