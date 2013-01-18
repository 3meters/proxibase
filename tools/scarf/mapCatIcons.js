/**
 * mapCatIcons
 *    create hard links for foursquare icons to factualids of similar categories
 */

var fs = require('fs')
var path = require('path')
var util = require('../../lib/utils')   // load proxibase util extensions
var dir4s = '../../assets/img/categories/foursquare'
var dirfact = '../../assets/img/categories/factual'
var sizes = ['_88', '_bg_88']
var suffix = '.png'

var str = fs.readFileSync('./categorymap.csv', 'utf8')
var lines = str.split('\r')

log(lines.length)

var linkNames = fs.readdirSync(dirfact)
linkNames.forEach(function(linkName) {
  fs.unlinkSync(path.join(dirfact, linkName))
})

sizes.forEach(function(size) {
  lines.forEach(function(line) {
    var cols = line.split(',')
    var idfact = cols[0]
    var id4s = cols[2]
    fs.linkSync(
      path.join(dir4s, id4s + size + suffix),
      path.join(dirfact, idfact + size + suffix)
    )
  })
})


