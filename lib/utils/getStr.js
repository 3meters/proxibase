/**
 * getStr: simple string-subtituion util for producing formated text and html.
 *
 *
 *   Errors on init are thrown.  All other errors are both returned and sent to stderr.
 *   In general this means the caller can expect things to always work and not check
 *   for errors on each return.  If someone messes up translating a string file the
 *   program will not crash:  the user will receive a strange error string, and an
 *   error stack trace will appear in the logs.
**/


var util = require('util')  // jshint ignore:line
var strs = {}


// Initialize the lib with a strings object
function init(strMap) {
  strs = strMap
}


/**
 * getStr: get a string with parameter substition in any language with an html version
 *
 * @id      String    required id of string
 * @params  [String]  params to be substuted as strings into returned text and html
 * @lan     String    language code, defaults to "en"
 *
 */
function getStr(id, params, lang) {

  lang = lang || "en"
  var err

  // Confims that the strings object supports the requested lang
  if (!strs[lang]) {
    err = new Error('getStr lang ' + lang + ' strings not found')
    console.error(err.stack)
    return err
  }

  // Find the string by id
  var str = strs[lang][id]
  if (!str)  {
    err = new Error('Missing string for lang ' + util.inspect(lang)  + ': ' + util.inspect(id))
    console.error(err.stack)
    return err
  }

  // Validate that the caller and the string author agree on the number of params being passed
  params = params || []
  if (params.length !== str.cParams) {
    err = new Error('Expected an array of ' + str.cParams + 'strings: ' + util.inspect(params))
    console.error(err.stack)
    return err
  }

  // Do the deed
  // In es6 this is expresed more elegantly as util.format(str.txt, ...params)
  var args = [str.text].concat(params)
  str.text = util.format.apply(null, args)

  if (str.html) {
    args = [str.html].concat(params)
    str.html = util.format.apply(null, args)
  }

  return str
}


module.exports = getStr
module.exports.init = init
