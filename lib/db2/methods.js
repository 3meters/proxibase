/**
 * db/methods.js
 *
 * methods on the collection objects
 */

var util = require('util')

module.exports = {
  hello: function() {
    util.log(this.collectionName + ' says hello')
  },
  getKeys: function() {
    return Object.keys(this)
  }
  safeSave: function(doc, options, fn) {

  }
}
