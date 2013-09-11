/**
 * Generate proxibase categories
 */

var util = require('../../lib/utils')   // load proxibase util extensions
var call = util.callService
var request = require('request')
var cli = require('commander')
var fs = require('fs')
var xl = require('xlsx')
var async = require('async')
var path = require('path')
var iconDir = '../../assets/img/categories'
var assetsDir = '../../assets'
var catsJsonFile = './categories.json'
var catMapper = './categorymap.xlsx'
var cats4sFile = 'cats4s.csv'
var catsFactFile = 'catsFact.csv'
var catsCandi = []
var suffix = '.png'
var providers = ['factual', 'google', 'foursquare']
var sizes = ['88', 'bg_88'] // the first is the default
var wb = null // Excel workbook


function start() {

  // This is a very low-level parser for xlsx files, but it was the
  // best I could find.  One would think something like the work below should
  // be built in, but perhaps he's just doing a building block module
  util.log('Reading ' + catMapper)
  wb = xl.readFile(catMapper)
  wb.SheetNames.forEach(function(name) {
    var sheet = wb.Sheets[name]
    if (sheet['!ref']) {  // cell that contains xls best guess of the active range
      var rows = []
      var r = xl.utils.decode_range(sheet['!ref']);
      for (var R = r.s.r; R <= r.e.r; ++R) {
        var row = []
        for (var C = r.s.c; C <= r.e.c; ++C) {
          var val = sheet[xl.utils.encode_cell({c:C, r:R})]
          if (val && val.v) row.push(val.v)
          else row.push('')
        }
        rows.push(row)
      }
    }
    sheet.data = rows
  })
  mapCats()
}


// map provider id to candi id based on the spreadsheet
// and write out to a .json file
function mapCats() {
  providers.forEach(function(provider) {
    util.log('Mapping ' + provider + ' categories to aircandi categories')
    var map = {}
    var mapFileName = 'cat_map_' + provider + '.json'
    var sheet = wb.Sheets['map_' + provider + '_candi']
    sheet.data.forEach(function(row) {
      map[row[0]] = row[2] // map each id
    })
    fs.writeFileSync(mapFileName, JSON.stringify(map))
    fs.writeFileSync(path.join(assetsDir, mapFileName), JSON.stringify(map))
  })
  finish()
}

function finish(err) {
  if (err) throw err
  util.log('finished ok')
}

start()
