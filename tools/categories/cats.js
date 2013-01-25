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
var catsJson = '../../assets/categories.json'
var cats4s = 'cats4s.csv'
var catsFact = 'catsFact.csv'
var catsCandi = 'catsCandi.csv'
var catMap = 'categorymap.csv'
var sizes = ['88', 'bg_88'] // the first is the default
var wb = null


// Command line interface
cli
  .option('-i, --icons', 'Refresh icon cache')
  .parse(process.argv)


function start() {
  log('Deleting old files')
  try {fs.unlinkSync(cats4s)} catch(e) {log(e.message)}
  try {fs.unlinkSync(catsFact)} catch(e) {log(e.message)}
  try {fs.unlinkSync(catsJson)} catch(e) {log(e.message)}
  var fileNames = fs.readdirSync(iconDirFact)
  fileNames.forEach(function(fileName) {
    fs.unlinkSync(path.join(iconDirFact, fileName))
  })
  if (cli.icons) {
    var fileNames = fs.readdirSync(iconDir4s)
    fileNames.forEach(function(fileName) {
      fs.unlinkSync(path.join(iconDir4s, fileName))
    })
  }

  // This is a very low-level parser for xlsx files, but it was the
  // best I could find.  One would think something like the work below should
  // be built in, but perhaps he's just doing a building block module
  wb = xl.readFile('categorymap.xlsx')
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
}


function getfoursquareCats() {
  var foursquareCats = {names: [], icons: []}
  call.foursquare({path: 'categories', logReq: true}, function(err, res) {
    if (err) throw err
    var cats = res.body.response.categories
    foursquareCats = parse4sCats(cats)
    log('Writing ' + catsJson)
    fs.writeFileSync(catsJson, JSON.stringify(cats))
    log('Writing ' + cats4s)
    writeCsvFile(cats4s, foursquareCats.names, function(err) {
      if (err) throw err
      scarfIcons(foursquareCats.icons)
    })
  })
}


function scarfIcons(icons) {
  if (!cli.icons) return getFactualCats()
  log('Scarfing ' + icons.length + ' icons: ')
  async.forEachSeries(icons, getIcon, function(err) {
    if (err) throw err
    getFactualCats()
  })
}


function getIcon(icon, cb) {
  var fileName = icon.id + '_' + icon.size + icon.suffix
  // TODO:  check for a 200 reqest status before piping to write stream
  request.get(icon.uri)
    .pipe(fs.createWriteStream(path.join(iconDir4s, fileName))
      .on('error', function(err) {return cb(err)})
      .on('close', function() {
        log(fileName)
        return cb()
      })
    )
}

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
    log('Writing factual categories')
    writeCsvFile(catsFact, factualNames, function(err) {
      if (err) throw err
      mapIcons()
    })
  })
}

function mapIcons() {
  return finish() //TODO undo short circuit
  log('Mapping factual icons to foursquare icons')
  var suffix = '.png'
  var str = fs.readFileSync(catMap, 'utf8')
  var lines = str.split('\r')

  sizes.forEach(function(size) {
    lines.forEach(function(line) {
      var cols = line.split(',')
      var idfact = cols[0]
      var id4s = cols[2]
      fs.linkSync(
        path.join(iconDir4s, id4s + '_' + size + suffix),
        path.join(iconDirFact, idfact + '_' + size + suffix)
      )
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
