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
var catsJsonFile = 'categories.json'
var catMapper = 'categorymap.xlsx'
var cats4sFile = 'cats4s.csv'
var catsFactFile = 'catsFact.csv'
var catsCandi = []
var suffix = '.png'
var providers = ['factual', 'google']
var sizes = ['88', 'bg_88'] // the first is the default
var wb = null // Excel workbook


// Command line interface
cli
  .option('-i, --icons', 'Refresh icon cache')
  .parse(process.argv)


function start() {

  function deleteAllFiles(dir) {
    var fileNames = fs.readdirSync(dir)
    fileNames.forEach(function(fileName) {
      try {fs.unlinkSync(path.join(dir, fileName))} catch(e) {} // swallow errors
    })
  }

  log('Deleting old files')
  try {fs.unlinkSync(cats4sFile)} catch(e) {}
  try {fs.unlinkSync(catsFactFile)} catch(e) {}
  try {fs.unlinkSync(catsJsonFile)} catch(e) {}
  try {fs.unlinkSync(path.join(assetsDir, catsJsonFile))} catch(e) {}

  providers.forEach(function(provider) {
    deleteAllFiles(path.join(iconDir, provider))
  })

  if (cli.icons) {
    deleteAllFiles(path.join(iconDir, 'foursquare'))
    deleteAllFiles(iconDir)
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
  getCandiCats()
}

// Transform the human written candi categorys in the mapper spreadsheet
// into an array of nested categories using the same shape as foursquare
// Only supports one level of category nesting, and parents must come first
function getCandiCats() {
  var map = {}
  wb.Sheets['candi'].data.forEach(function(row) {
    var cat = {
      id: row[0],
      name: row[1],
      categories: [],
    }
    var parent = row[2]
    if (!parent) map[cat.id] = cat
    else map[parent].categories.push(cat)
  })
  for (key in map) { catsCandi.push(map[key]) }
  getFoursquareCats()
}

function getFoursquareCats() {
  var foursquareCats = {names: [], icons: []}
  call.foursquare({path: 'categories', logReq: true}, function(err, res) {
    if (err) throw err
    var cats = res.body.response.categories

    foursquareCats = parse4sCats(cats)
    cats = cats.concat(catsCandi) // graft in our own categories
    log('Writing ' + catsJsonFile)
    fs.writeFileSync(catsJsonFile, JSON.stringify(cats))
    fs.writeFileSync(path.join(assetsDir, catsJsonFile), JSON.stringify(cats))
    log('Writing ' + cats4sFile)
    writeCsvFile(cats4sFile, foursquareCats.names, function(err) {
      if (err) throw err
      scarfFoursquareIcons(foursquareCats.icons)
    })
  })
}

function getIcon(icon, cb) {
  var fileName = icon.id + '_' + icon.size + icon.suffix
  // TODO:  check for a 200 reqest status before piping to write stream
  request.get(icon.uri)
    .pipe(fs.createWriteStream(path.join(iconDir, fileName))
      .on('error', function(err) {return cb(err)})
      .on('close', function() {
        log(fileName)
        fs.linkSync(
          path.join(iconDir, fileName),
          path.join(iconDir, 'foursquare', fileName)
        )
        return cb()
      })
    )
}

function scarfFoursquareIcons(icons) {
  if (!cli.icons) return getFactualCats()
  log('Scarfing ' + icons.length + ' icons: ')
  async.forEachSeries(icons, getIcon, function(err) {
    if (err) throw err
    linkCandiIcons()
  })
}

function linkCandiIcons() {
  var sheet = wb.Sheets['map_candi_foursquare']
  sheet.data.forEach(function(row) {
    sizes.forEach(function(size) {
      var idCandi = row[0]
      var id4s = row[2]
      fs.linkSync(
        path.join(iconDir, id4s + '_' + size + suffix),
        path.join(iconDir, idCandi + '_' + size + suffix)
      )
    })
  })
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
    log('Writing ' + catsFactFile)
    writeCsvFile(catsFactFile, factualNames, function(err) {
      if (err) throw err
      mapIcons()
    })
  })
}


function mapIcons() {
  providers.forEach(function(provider) {
    log('Mapping ' + provider + ' icons to foursquare icons')
    var sheet = wb.Sheets['map_' + provider + '_foursquare']
    sheet.data.forEach(function(row) {
      sizes.forEach(function(size) {
        var iconName = row[0] + '_' + size + suffix
        var iconName4s = row[2] + '_' + size + suffix
        fs.linkSync(
          path.join(iconDir, iconName4s),
          path.join(iconDir, provider, iconName)
        )
      })
    })
  })
  finish()
}

function parse4sCats(categories) {
  var names = []
  var icons = []
  parseCats(null, categories)

  function parseCats(parent, categories) {
    categories.forEach(function(category) {
      if (category.categories && category.categories.length) {
        parseCats(category, category.categories) // recurse
      }
      // Parse the names for the csv output file
      var name = {id: category.id, name: category.name}
      if (parent) {
        name.parentId = parent.id
        name.parentName = parent.name
      }
      names.push(name)
      // Extract the icon map to the assets file
      sizes.forEach(function(size) {
        icons.push({
          id: category.id,
          size: size,
          suffix: category.icon.suffix,
          uri: category.icon.prefix + size + category.icon.suffix
        })
      })
      // Prune properties we don't use
      delete category.pluralName
      delete category.shortName
      delete category.icon
    })
  }
  return {names: names, icons: icons}
}


function writeCsvFile(fileName, names, cb) {
  var ws = fs.createWriteStream(path.join(__dirname, fileName))
  names.forEach(function(name) {
    ws.write(name.id + ',' + name.name + ',')
    if (name.parentId) ws.write(name.parentId)
    ws.write(',')
    if (name.parentName) ws.write(name.parentName)
    ws.write('\n')
  })
  ws.destroySoon()
  ws.on('error', function(err) {cb(err)})
  ws.on('close', function() {
    log(fileName + ' written')
    cb()
  })
}


function finish(err) {
  if (err) throw err
  log('finished ok')
}

start()
