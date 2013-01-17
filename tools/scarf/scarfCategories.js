/**
 * get categories images and load them into the file tree
 */

var util = require('../../lib/utils')   // load proxibase util extensions
var call = util.callService
var request = require('request')
var fs = require('fs')
var async = require('async')
var path = require('path')
var dir = '../../assets/img/categories/foursquare'
var sizes = ['88', 'bg_88']


function start() {
  // Blow away all files in dir
  var fileNames = fs.readdirSync(dir)
  fileNames.forEach(function(fileName) {
    fs.unlinkSync(path.join(dir, fileName))
  })
  getfoursquareCats()
}


function getfoursquareCats() {
  var foursquareCats = {
    names: [],
    icons: []
  }
  call.foursquare({path: 'categories', logReq: true}, function(err, res) {
    if (err) throw err
    foursquareCats = parse(res.body.response.categories)
    writeFile(foursquareCats.names, 'foursquareCats.csv', function(err) {
      if (err) throw err
      scarfIcons(foursquareCats.icons)
    })
  })
}


function scarfIcons(icons) {
  log('writing ' + icons.length + ' icons: ')
  async.forEach(icons, getIcon, function(err) {
    if (err) throw err
    getFactualCats()
  })
}


function getIcon(icon, cb) {
  var fileName = icon.id + '_' + icon.size + icon.suffix
  request.get(icon.uri)
    .pipe(fs.createWriteStream(path.join(dir, fileName))
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
  request({uri:uri, json:true}, function(err, res, body) {
    if (err) throw err
    if (!body) throw new Error('Could not get ', uri)
    for (var key in body) {
      factualNames.push({
        id: key,
        name: body[key].labels.en,
      })
    }
    writeFile(factualNames, 'factualCategories.csv', function(err) {
      if (err) throw err
      finish()
    })
  })
}


function parse(categories) {
  var names = []
  var icons = []
  innerParse(categories)
  function innerParse(categories) {
    categories.forEach(function(category) {
      if (category.categories) innerParse(category.categories) // recurse
      names.push({id: category.id, name: category.name})
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
  return {names: names, icons: icons}
}


function writeFile(names, fileName, cb) {
  var ws = fs.createWriteStream(path.join(__dirname, fileName))
  names.forEach(function(name) {
    ws.write(name.id + ',' + name.name + '\n')
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
