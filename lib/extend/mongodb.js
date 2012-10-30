/*
 * Extend mongodb native to provide validation hooks
 */

var mongodb = require('mongodb')
  , C = mongodb.Collection.prototype

C._insert = C.insert
C._update = C.update
C._save = C.save
C._remove = C.remove

C.insert = function(docs, options, callback) {
  console.log('I overrode insert')
  C._insert.call(this, docs, options, callback)
}

C.alive = function() {
  console.log('I am ' + this.collectionName)
}

