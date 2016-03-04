/*
 * getStr:  simple string-subtituion lib for producing formated
 *    text and html.
 */

var strs = require('../str')
var u = require('./')  // yes, circular


function getStr(id, params, lang) {
  lang = lang || "en"
  var err

  if (!(strs && strs[lang])) {
    throw new Error('Lang ' + lang + ' strings not found')
  }

  var str = u._.cloneDeep(strs[lang][id])

  if (!str)  {
    err = new Error('Missing string for lang ' + u.inspect(lang)  + ': ' + u.inspect(id))
    u.logErr(err.stack)
    return err
  }

  params = params || []
  if (params.length !== str.cParams) {
    err = new Error('Expected an array of ' + str.cParams + 'strings: ' + u.inspect(params))
    u.logErr(err.stack)
    return err
  }

  // in es6 this is u.format(str.txt, ...params)
  var args = [str.text].concat(params)
  str.text = u.format.apply(null, args)

  if (str.html) {
    args = [str.html].concat(params)
    str.html = u.format.apply(null, args)
  }

  return str
}


module.exports = getStr
