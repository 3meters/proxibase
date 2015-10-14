/**
 *  Documents schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sDocument = statics.schemas.document
var config = util.config

var document = {
  id: sDocument.id,
  name: sDocument.name,
  collection: sDocument.collection,

  indexes: [
    {index: 'name'},
  ],

  before: {
    insert: [notify],
  }
}

// Documents are where user feedback is stored.  Notify us when we get a new one.
function notify(doc, previous, options, cb) {
  if (!(config.sendMail && config.notify && config.notify.onFeedback)) return cb()
  if ('report' === doc.type || 'feedback' === doc.type) {
    util.sendMail({
      to: config.notify.to,
      subject: 'User ' + doc.type + ' from ' + doc._owner + ' ' + util.nowFormatted(),
      body: util.inspect(doc)
    })
  }
  cb()
}

exports.getSchema = function() {
  return mongo.createSchema(base, document)
}
