/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 *
 *    (@req, @cb) callsback with (err, results)
 *      for consumption by custom methods that want to futher massage
 *      results
 *
 */

var async = require('async')
var assert = require('assert')
var db = util.db
var data = require('./')

// template query params
var _query = {
  user:     {type: 'string'},
  session:  {type: 'string'},
  version:  {type: 'string'},
  lang:     {type: 'string'},
  ids:      {type: 'array'},
  name:     {type: 'string'},
  find:     {},
  fields:   {type: 'array'},
  sort:     {type: 'object'},
  count:    {},
  countBy:  {type: 'array'},
  skip:     {type: 'number'},
  limit:    {type: 'number'},
  lookups:  {}
}


// get /data/collection/id?
module.exports = function(req, arg1) {  // arg1 can be cb or res

  var cb = type.isFunction(arg1) ? arg1 : util.send(arg1)
  var selector = {}
  var options = {}
  var searchNames = []
  var allFields = []
  var baseFields = []
  var limit = 1000

  var err = data.scrub(req)
  if (err) return cb(err)

  err = util.check(_query, req.query, {strict: true, allowEmpty: true})
  if (err) return cb(err)

  selector = req.query.find || {}
  if (req.query.ids) selector._id = {$in: req.query.ids}

  if (req.query.name) selector.namelc = new RegExp('^' + req.query.name.toLowerCase())

  if (req.query.limit) limit = Math.min(limit, parseInt(req.query.limit))
  options.limit = limit + 1 // cheap trick

  // whitelist valid options
  if (req.query.fields) options.fields = req.query.fields
  if (req.query.skip) options.skip = req.query.skip

  // For some reason the javascript driver wants the sort
  // specified in a different format than the mongo console.
  // We support the mongo console format, and convert it to
  // what the driver wants
  if (req.query.sort) {
    options.sort = []
    Object.keys(req.query.sort).forEach(function(key) {
      if (util.truthy(req.query.sort[key])) options.sort.push([key, 'asc'])
      else options.sort.push([key, 'desc'])
    })
  }


  // Count
  if (util.truthy(req.query.count)) {
    return req.collection.find(selector, options)
      .count(function process(err, count) {
        if (err) return cb(err)
        cb(null, {count:count})
      })
  }

  // CountBy
  if (req.query.countBy) return aggregateBy(selector, 'countBy', req.query.countBy)

  // Regular find
  return req.collection.find(selector, options).toArray(sendResults)

  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  // TODO: require admin credentials to run countBy queries?
  function aggregateBy(selector, agg, groupOn) {

    // Make sure all the groupOn fields are in the schema
    var badFields = groupOn.filter(function(field) {
      return !req.collection.schema.fields[field]
    })
    if (badFields.length) return cb(perr.badParam(badFields))

    switch(agg) {
      case 'countBy':
        var map = function() {
          var self = this
          var id = {}
          groupOn.forEach(function(field) {
            id[field] = self[field]
          })
          emit(id, 1)
        }
        var reduce = function(key, vals) {
          var count = 0
          vals.forEach(function(val) { count+= val })
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
      if (err) return cb(err)
      var results = []
      docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
      // mongo returns very generic looking results from map reduce operations
      // transform those results back into the terms of the original query
      docs.forEach(function(doc) {
        var result = {}
        groupOn.forEach(function(field) {
          result[field] = doc._id[field]
        })
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
   * @cb    cb
   */
  function getLookups(docs, refs, cb) {

    if (!refs) return cb(docs)
    if (typeof refs !== 'object') refs = _.clone(req.collection.schema.refs)
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
    if (err) return cb(err)
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
    return cb(null, body)
  }
}
