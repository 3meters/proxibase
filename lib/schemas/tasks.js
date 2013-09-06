/**
 *  Tasks schema
 */

var mongo = require('../db')
var base = require('./_base')
var path = require('path')
var later = require('later')  // https://github.com/bunkat/later

var task = {

  id: util.statics.collectionIds.tasks,

  system: true,  // only admins can access

  fields: {
    // See http://bunkat.github.io/later/schedules.html for schedule format docs
    schedule:     { type: 'object', required: true, value: {
      schedules:    { type: 'array', required: true },
      exceptions:   { type: 'array' }
    }},
    module:       { type: 'string', required: true },
    method:       { type: 'string', required: true },
    args:         { type: 'array' },
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
  var err = chk(doc, task.fields)
  if (err) return perr.badValue(err.message||err)
  var modulePath = path.join(util.statics.appDir, doc.module)
  var mod = require(modulePath)
  if (!mod) return perr.badValue('Invalid module: ' + doc.module)
  var fn = mod[doc.method]
  if (!tipe.isFunction(fn)) return perr.badValue('Invalid method: ' + doc.method)
  try { task = later.setInterval(function() {fn.apply(null, doc.args)}, doc.schedule) }
  catch (err) { return err }
  util.tasks[doc._id] = task
  log('Started task ' + doc.name ? doc.name : 'anonymous')
  return null
}


function clear(doc) {
  if (!util.tasks[doc._id]) {
    return perr.serverError('Clear task ' + doc._id + ' failed. Task not found.')
  }
  util.tasks[doc._id].clear()
  delete util.tasks[doc._id]
  log('task ' + doc._id + ' named: ' + doc.name + ' cleared')
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
