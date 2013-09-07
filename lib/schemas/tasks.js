/**
 *  Tasks schema
 */

var mongo = require('../db')
var base = require('./_base')
var path = require('path')
var later = require('later')  // https://github.com/bunkat/later

var taskSchema = {

  id: util.statics.collectionIds.tasks,

  system: true,  // only admins can access

  fields: {
    schedule: {type: 'object', required: true, value: {
      // See http://bunkat.github.io/later/schedules.html
      schedules:  {type: 'array', required: true},
      exceptions: {type: 'array'}
    }},
    module:   {type: 'string', required: true},   // relative to prox/lib
    method:   {type: 'string', required: true},   // must be exported
    args:     {type: 'array'},                    // arguments passed to method
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


// Start a recurring task based on a task document
function start(doc) {

  // Validate doc against schema
  var err = chk(doc, taskSchema.fields)
  if (err) return perr.badValue(err.message||err)

  // Validate module
  var modulePath = path.join(util.statics.appDir, doc.module)
  var mod = require(modulePath)
  if (!mod) return perr.badValue('Invalid module: ' + doc.module)

  // Validate method
  var fn = mod[doc.method]
  if (!tipe.isFunction(fn)) return perr.badValue('Invalid method: ' + doc.method)

  // Try creating a recurring task
  try { task = later.setInterval(function() {fn.apply(null, doc.args)}, doc.schedule) }
  catch (err) { return err }

  // Success
  util.tasks[doc._id] = task
  log('Started task ' + doc.name ? doc.name : 'anonymous')
  return null
}


// Clear a recurring task based on a task document
function clear(doc) {
  if (!util.tasks[doc._id]) {  // should never happen
    return perr.serverError('Clear task failed, task not found:', doc)
  }
  util.tasks[doc._id].clear()
  delete util.tasks[doc._id]
  log('task cleared:', doc)
  return null
}


// Insert a new task document
function insert(doc, previous, options, cb) {
  cb(start(doc))
}


// Update an existing task document
function update(doc, previous, options, cb) {
  clear(doc)
  cb(start(doc))
}


// Remove a task document
function remove(doc, previous, options, cb) {
  cb(clear(doc))
}


exports.getSchema = function() {
  return mongo.createSchema(base, taskSchema)
}
