/**
 * Generate proxibase categories
 */

var util = require('proxutils')   // load proxibase util extensions
var log = util.log
var tipe = util.tipe
var scrub = util.scrub
var call = util.callService
var request = require('request')
var cli = require('commander')
var fs = require('fs')
var xl = require('xlsx')
var async = require('async')
var path = require('path')
var iconDir = '../../assets/img/categories'
var assetsDir = '../../assets'
var catsJsonFile = 'categories.json'
var catMapJsonFile = 'catmap.json'
var catMapper = 'categorymap.xlsx'
var cats4sFile = 'cats4s.csv'
var catsFactFile = 'catsFact.csv'
var catsCandi = []
var suffix = '.png'
var providers = ['factual', 'google', 'foursquare']
var icons = []
var sizes = ['88', 'bg_88'] // the first is the default
var wb = null // Excel workbook


// Command line interface
cli
  .option('-i, --icons', 'Refresh icon cache')
  .parse(process.argv)


function start() {

  log('Deleting old files')
  try {fs.unlinkSync(cats4sFile)} catch(e) {}
  try {fs.unlinkSync(catsFactFile)} catch(e) {}

  providers.forEach(function(provider) {
    var mapFileName = 'catmap_' + provider + '.json'
    try {fs.unlinkSync(mapFileName)} catch (e) {}
    try {fs.unlinkSync(path.join(assetsDir, mapFileName))} catch (e) {}
  })


  if (cli.icons) {
    log('Deleting icons')
    var fileNames = fs.readdirSync(iconDir)
    fileNames.forEach(function(fileName) {
      try {fs.unlinkSync(path.join(dir, fileName))} catch(e) {} // swallow errors
    })
  }


  // This is a very low-level parser for xlsx files, but it was the
  // best I could find.  One would think something like the work below should
  // be built in, but perhaps he's just doing a building block module
  log('Reading ' + catMapper)
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
  getFoursquareCats()
}


// Get the current 4s categories from their public web service
function getFoursquareCats() {
  var cats = {}
  log('Fetching foursquare cats')
  call.foursquare({path: 'categories', logReq: true}, function(err, res) {
    if (err) throw err

    // Transform category objects so they are pointing to local icons
    // and using a photo object instead of an icon object.
    var transformedCats = transform(util.clone(res.body.response.categories))

    writeCategoriesFile(transformedCats)

    cats = flatten(res.body.response.categories)

    writeCsvFile(cats4sFile, cats, function(err) {
      if (err) throw err
      scarfFoursquareIcons(icons, cats)
    })
  })
}

function transform(categories) {
  _transform(categories)

  function _transform(categories) {
    categories.forEach(function(category) {
      if (category.categories && category.categories.length) {
        _transform(category.categories) // recurse
      }

      category.photo = {
        source: 'assets.categories',
        prefix: category.id + '_',
        suffix: '.png',
      }

      delete category.icon
      delete category.pluralName
      delete category.shortName
    })
  }
  return categories
}


// Graft in our own categories in the same format as foursquare
// then write the file
function writeCategoriesFile(foursquareCats) {

  var map = {}
  wb.Sheets['candi'].data.forEach(function(row) {
    var cat = {
      id: row[0],
      name: row[1],
      photo: {
        source: 'assets.categories',
        prefix: row[0] + '_',
        suffix: '.png',
      },
      categories: [],
    }
    var parent = row[2]
    if (!parent) map[cat.id] = cat
    else map[parent].categories.push(cat)
  })
  for (key in map) { foursquareCats.push(map[key]) }
  writeJsonFileSync(catsJsonFile, foursquareCats)
}

// Recursively un-nest 4square's nested hirearchy of categories into
// a single-level map with each category including its parent.
// In passing, load the module global icons array
function flatten(categories) {
  var flatCats = {}
  _flatten(null, categories)

  function _flatten(parent, categories) {
    var flatCat = {}
    categories.forEach(function(category) {
      if (category.categories && category.categories.length) {
        _flatten(category, category.categories) // recurse
      }
      // Parse the names for the csv output file
      flatCat = {id: category.id, name: category.name}
      if (parent) {
        flatCat.parentId = parent.id
        flatCat.parentName = parent.name
      }
      flatCats[flatCat.id] = flatCat

      // Extract the icon map to the assets file
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
  return flatCats
}


function scarfFoursquareIcons(icons, cats) {
  if (!cli.icons) return graftCandiCats(cats)

  log('Scarfing ' + icons.length + ' icons: ')
  async.forEachSeries(icons, getIcon, function(err) {
    if (err) throw err
    graftCandiCats(cats)
  })

  function getIcon(icon, cb) {
    var fileName = icon.id + '_' + icon.size + icon.suffix
    // TODO:  check for a 200 reqest status before piping to write stream
    request.get(icon.uri)
      .pipe(fs.createWriteStream(path.join(iconDir, fileName))
      .on('error', function(err) {return cb(err)})
      .on('close', function() {
        log(fileName)
        return cb()
      })
    )
  }
}


// Add our custom cats to the flattend cats
function graftCandiCats(cats) {
  log('Grafting in custom candi categories')
  var map = {}
  wb.Sheets['candi'].data.forEach(function(row) {
    var cat = {
      id: row[0],
      name: row[1],
      parentId: row[2],
      parentName: row[3],
    }
    cats[cat.id] = cat
  })

  writeJsonFileSync(catMapJsonFile, cats)
  getFactualCats()
}


// This is a non-used intermediate file.  Copy paste it into the spreadsheet
// If factual changes their categories enough to warrant remapping
function getFactualCats() {
  var factualNames = []
  var uri = 'https://raw.github.com/Factual/places/master/categories/factual_taxonomy.json'
  log('Getting factual categories')
  request({uri:uri, json:true}, function(err, res, body) {
    if (err) throw err
    if (!body) throw new Error('Could not get ', uri)
    for (var key in body) {
      var cat = {
        id: key,
        name: body[key].labels.en.replace(/\,/g, ' and'), // we make csv files
      }
      if (body[key].parents && body[key].parents.length) {
        cat.parentId = body[key].parents[0] // Just the first one now
      }
      factualNames.push(cat)
    }
    writeCsvFile(catsFactFile, factualNames, function(err) {
      if (err) throw err
      mapCats()
    })
  })
}

// map provider id to candi id based on the spreadsheet
// and write out to a .json file
function mapCats() {
  providers.forEach(function(provider) {
    util.log('Mapping ' + provider + ' categories to aircandi categories')
    var map = {}
    var mapFileName = 'catmap_' + provider + '.json'
    var sheet = wb.Sheets['map_' + provider + '_candi']
    sheet.data.forEach(function(row) {
      map[row[0]] = row[2] // map each id
    })
    writeJsonFileSync(mapFileName, map)
  })
  finish()
}


// Helper that serialize a json file to the current directory
// and a copy to the assets directory
function writeJsonFileSync(fileName, obj) {
  fs.writeFileSync(fileName, JSON.stringify(obj))
  fs.writeFileSync(path.join(assetsDir, fileName), JSON.stringify(obj))
  log('JSON file ' + fileName + ' written')
}


// Helper that writes a csv file of a category map using writeStream,
// mainly as an excersize in using writeStream
function writeCsvFile(fileName, cats, cb) {
  var ws = fs.createWriteStream(path.join(__dirname, fileName))
  for (var id in cats) {
    var cat = cats[id]
    ws.write(cat.id + ',' + cat.name + ',')
    if (cat.parentId) ws.write(cat.parentId)
    ws.write(',')
    if (cat.parentName) ws.write(cat.parentName)
    ws.write('\n')
  }
  ws.destroySoon()
  ws.on('error', function(err) {cb(err)})
  ws.on('close', function() {
    log('Csv file ' + fileName + ' written')
    cb()
  })
}


function finish(err) {
  if (err) throw err
  log('finished ok')
}

start()
