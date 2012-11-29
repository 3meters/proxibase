/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *    (@req, @callback) callsback with (err, results)
 *      for consumption by custom methods that want to futher massage
 *      results
 *
 */

var async = require('async')
var assert = require('assert')
var util =  require('util')
var db = util.db
var log = util.log
var data = require('./index')


// get /data/collection/id?
module.exports = function(req, arg1) {  // arg1 can be callback or res

  var callback = (typeof arg1 === 'function') ? arg1 : util.send(arg1)
  var selector = {}
  var options = {}
  var searchNames = []
  var allFields = []
  var baseFields = []
  var limit = 1000

  var err = data.scrub(req)
  if (err) return callback(err)

  err = checkQuery(req.query)
  if (err) return callback(err)

  selector = req.query.find || {}
  if (req.query.ids) selector._id = {$in: req.query.ids}

  if (req.query.names) {
    // convert search terms to lowercase and search the namelc field
    req.query.names.forEach(function(name) {
      // TODO: how to decode spaces in get URLs?
      searchNames.push(decodeURIComponent(name).toLowerCase())
    })
    selector.namelc = {$in: searchNames}
  }

  if (req.query.fields) {
    allFields = req.query.fields
    for (var i = allFields.length; i--;) {
      var dotAt = allFields[i].indexOf('.')
      if (dotAt < 0) { 
        // non-qualified field name, apply to base table
        baseFields.push(allFields[i])
      } else {
        childTableName = allFields[i].substr(0, dotAt)
        // TODO: add child table field names
      }
    }
    if (baseFields.length) options.fields = baseFields
  }

  if (req.query.limit) limit = Math.min(limit, parseInt(req.query.limit))
  options.limit = limit + 1 // cheap trick

  options.sort = req.query.sort || null
  options.skip = req.query.skip || null

  // Count
  if (req.query.count) {
    return req.collection.find(selector, options)
      .count(function process(err, count) {
        if (err) return callback(err)
        callback(null, {count:count})
      })
  }

  // CountBy
  if (req.query.countBy) return aggregateBy(selector, 'countBy', req.query.countBy)

  // Regular find
  return req.collection.find(selector, options).toArray(sendResults)

  // Check query
  function checkQuery(query) {

    var validQuery = {
      user: 'string',
      session: 'string',
      ids: [],
      names: [],
      find: {},
      fields: [],
      sort: {},
      count: true,
      countBy: 'string',
      skip: 1,
      limit: 1,
      lookups: true
    }

    for (key in query) {
      if (!validQuery[key]) return proxErr.badParam(key)
      if (util.typeOf(validQuery[key]) === 'array'
          && util.typeOf(query[key]) !== 'array') {
        return proxErr.badType(key + ' must be type array')
      }
      // TODO: consider more typechecking
    }
  }


  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(selector, agg, groupOn) {
    // TODO: require admin credentials to run countBy queries?
    if (!req.collection.schema.fields[groupOn]) {
      return callback(proxErr.badParam(groupOn + ' must be a field in the collection'))
    }
    switch(agg) {
      case 'countBy':
        var map = function() { emit(this[groupOn], 1) }
        var reduce = function(k, v) {
          var count = 0
          v.forEach(function(c) { count+= c })
          return count
        }
        break
      default:
        throw new Error('Invalid call to aggregateBy')
    }
    var options = {
      query: selector,
      scope: {groupOn: groupOn}, // local vars passed to mongodb
      out: {inline: 1}
    }
    req.collection.mapReduce(map, reduce, options, function(err, docs) {
      if (err) return callback(err)
      var results = []
      docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
      // mongo returns very generic looking results from map reduce operations
      // transform those results back into the terms of the original query
      docs.forEach(function(doc) {
        var result = {}
        result[groupOn] = doc._id
        result[agg] = doc.value
        results.push(result)
      })
      return sendResults(null, results)
    })
  }

  /*
   * getLookups: populate refs (aka foreign keys) with the name property
   *   of the referenced collection
   *
   * @docs  array of documents
   * @refs  boolean or object.  If boolean lookup value from the schema of
   *        the collection otherwise {field:collection}
   * @cb    callback
   */
  function getLookups(docs, refs, cb) {

    if (!refs) return cb(docs)
    if (typeof refs !== 'object') refs = util.clone(req.collection.schema.refs)
    var parents = {} // map of parent collections, often only one: users
    var refNames = {}  // name of property looked-up value will be stored in
    for (field in refs) {
      parents[refs[field]] = true
      refNames[field] = field === '_id'
        ? 'name'           // self join
        : field.slice(1)   // e.g. _owner => owner
    }

    // For each lookup table, even if several fields point to the same table
    async.forEach(Object.keys(parents), lookupValues, finish)

    // Make a map of all the unique _ids to be looked up
    function lookupValues(parent, next) {
      var valMap = {}
      docs.forEach(function(doc) {
        for (var field in refs) {
          if (doc[field]) valMap[doc[field]] = null
        }
      })

      // Convert to an ordered array for passing to mongodb find $in
      var vals = Object.keys(valMap).sort()

      // Look up the cooresponding name properties
      db.collection(parent).find({_id: {$in: vals}, name: /.*/}, {name: 1})
        .toArray(function(err, lookups) {
          if (err) return next(err)
          lookups.forEach(function(lookup) {
            valMap[lookup._id] = lookup.name  // add the name to valMap
          })
          // graft back in the names into the original documents array
          docs.forEach(function(doc) {
            for (field in refs) {
              var val = valMap[doc[field]]
              if (val) doc[refNames[field]] = val  // e.g. doc.owner = george
            }
          })
          next()
        })
    }

    // Delete the lookups property from the request's query and call back
    function finish(err) {
      delete req.query.lookups
      cb(err, docs)
    }
  }


  function sendResults(err, docs) {
    if (err) return callback(err)
    var lookups = req.query.lookups
    if (lookups) return getLookups(docs, lookups, sendResults)
    var more = false
    if (docs.length > limit) {
      docs.pop()
      more = true
    }
    var body = {
      data: docs,
      count: docs.length,
      more: more
    }
    return callback(null, body)
  }
}
