/**
 * utils/match.js
 *
 *   poor-man's enum
 *
 *   return true if str equals strEnum or, if strEnum
 *   is delimted by |, any of its elements
 *
 */
var util = require('./')

module.exports = function(str, strEnum) {
  if (!(strEnum &&
        util.type.isString(strEnum) &&
        strEnum.indexOf('|') > 0)) {
    return (str === strEnum)
  }
  return strEnum.split('|').some(function(eStr) {
    return (str === eStr)
  })
}
