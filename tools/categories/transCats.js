/**
 * Transform proxibase categories
 */

var fs = require('fs')
var util = require('../../lib/utils')   // load proxibase util extensions
var cats = require('./catsArray.json')
var nCats = {}

cats.forEach(function(cat) {
  nCats[cat.id] = cat
})

fs.writeFileSync('categories.json', JSON.stringify(nCats))
