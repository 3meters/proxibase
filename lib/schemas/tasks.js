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
    name:     {type: 'string', required: true},
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

  var err, module, modulePath, methodChain, fn, thisContext

  // Validate doc against schema
  err = chk(doc, taskSchema.fields)
  if (err) return perr.badValue(err.message||err)

  // Validate module
  modulePath = path.join(util.statics.appDir, doc.module)
  module = require(modulePath)
  if (!module) return perr.badValue('Invalid module: ' + doc.module)

  // Validate method
  thisContext = module
  methodChain = doc.method.split('.')
  if (1 === methodChain.length) {
    fn = module[doc.method]
  }
  else {
    fn = module[methodChain[0]]
    methodChain.shift()
    methodChain.forEach(function(method) {
      thisContext = fn
      fn = fn[method]
    })
  }
  if (!tipe.isFunction(fn)) return perr.badValue('Invalid method: ' + doc.method)

  // Try creating a recurring task
  try {
    task = later.setInterval(
      function() {
        // Try running the task
        log('Executing task ' + doc.name)
        try { fn.apply(thisContext, doc.args) }
        catch (e) { logErr('Task error for ' + doc.name, e.stack||e) }
      },
      doc.schedule)
  }
  catch (err) { return err }

  // Success
  util.tasks[doc._id] = task
  log('Started scheduled task:', doc)
  return null
}


// Clear a recurring task based on a task document
// Noop if the task was not succesfully started
function clear(doc) {
  if (util.tasks[doc._id]) {
    util.tasks[doc._id].clear()
    delete util.tasks[doc._id]
    log('Task cleared:', doc)
  }
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
