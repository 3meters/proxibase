/**
 *  Tasks schema
 */

var mongo = require('../db')
var base = require('./_base')
var later = require('later')  // https://github.com/bunkat/later

var task = {

  id: util.statics.collectionIds.tasks,

  system: true,  // only admins can access

  fields: {
    schedule: { type: 'text', required: true },
    fnPath:   { type: 'text', required: true },
    params:   { type: 'text' }  // |-separated strings for now
  },

  validators: {
    insert: [insert],
    update: [update],
    remove: [remove],
  },

  methods: {
    start: start,
    clear: clear,
  },
}


function start(doc) {
  var task
  if (doc.name) log('Starting task ' + doc.name)
  try {
    task = later.setInterval(
      doc.fn.apply(null, doc.params.split('|')),
      doc.schedule
    )
  }
  catch (e) { return e }
  util.tasks[doc._id] = task
  return null
}


function clear(doc) {
  if (!util.tasks[doc._id]) return new Error('Clear task ' + doc._id + ' failed. Task not found.')
  util.tasks[doc._id].clear()
  delete util.tasks[doc._id]
  log('task ' + task._id + ' named: ' + task.name + ' cleared')
  return null
}


function insert(doc, previous, options, cb) {
  cb(start(doc))
}


function update(doc, previous, options, cb) {
  clear(doc)
  cb(start(doc))
}


function remove(doc, previous, options, cb) {
  cb(clear(doc))
}


exports.getSchema = function() {
  return mongo.createSchema(base, task)
}
