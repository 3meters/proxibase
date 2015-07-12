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

  fields: {
    enabled:      { type: 'boolean', default: true }, // used to control tasks
  },

  indexes: [
    {index: 'name'},
  ],

  before: {
    insert: [notify],
  }
}

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
