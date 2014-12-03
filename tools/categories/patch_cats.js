/**
 * Generate proxibase categories
 */

var util = require('proxutils')   // load proxibase util extensions
var log = util.log
var fs = require('fs')
var xl = require('xlsx')
var path = require('path')

var assetsDir = '../../assets'
var catsJsonFile = 'categories_patch.json'
var catList = 'category_list.xlsx'

start()

function start() {

  // This is a very low-level parser for xlsx files, but it was the
  // best I could find.  One would think something like the work below should
  // be built in, but perhaps he's just doing a building block module
  //
  // Preprocesses the active rows info a collection hanging off sheet.data
  log('Reading ' + catList)
  var wb = xl.readFile(catList)

  wb.SheetNames.forEach(function(name) {
    var sheet = wb.Sheets[name]
    if (sheet['!ref']) {  // cell that contains xls best guess of the active range
      var rows = []
      var r = xl.utils.decode_range(sheet['!ref']);
      for (var R = r.s.r; R <= r.e.r; ++R) {
        var row = []
        for (var C = r.s.c; C <= r.e.c; ++C) {
          var val = sheet[xl.utils.encode_cell({c:C, r:R})]
          if (val && val.v)
            row.push(val.v)
          else
            row.push('')
        }
        if (row[0] === '' || row[0] === 'id') continue
        rows.push(row)
      }
    }
    sheet.data = rows
  })

  // Walk the sheet and build category tree

  var resultsArray = []
  var parents = {}

  wb.Sheets['patches_v2'].data.forEach(function(row) {
    var cat = {
      id: row[0],
      name: row[1],
      photo: {
        source: 'assets.categories',
        prefix: row[4],
      },
      categories: [],
    }

    parents[cat.id] = cat
    var parentId = row[2]
    if (parentId && parents[parentId]) {
      parents[parentId].categories.push(cat)
    }
    else {
      resultsArray.push(cat)
    }
  })

  writeJsonFileSync(catsJsonFile, resultsArray)
  finish()
}


// Helper that serialize a json file to the current directory
// and a copy to the assets directory
function writeJsonFileSync(fileName, obj) {
  fs.writeFileSync(fileName, JSON.stringify(obj))
  fs.writeFileSync(path.join(assetsDir, fileName), JSON.stringify(obj))
  log('JSON file ' + fileName + ' written')
}


function finish(err) {
  if (err) throw err
  log('finished ok')
}