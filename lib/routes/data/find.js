/**
 * routes/data/find.js
 *
 *    Performs RESTful find on mongo collections
 */


var util =  require('util')
  , db = util.db    // mongoskin connection
  , log = util.log


// get /data/collection/id?
module.exports = function(req, res) {

  var limit = 1000
    , options = {}
    , searchNames = []
    , allFields = []
    , baseFields = []
    , moreRecords = false
    , q = checkQuery(req.query)

  if (q instanceof Error) return res.error(q)
  var selector = q.find || {}

  if (req.query.ids) selector._id = {$in: req.query.ids}

  if (req.query.name) {
    // convert search terms to lowercase and search the namelc field
    req.query.name.forEach(function(name) {
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

  if (req.query.limit) {
    limit = Math.min(limit, parseInt(req.query.limit))
  }
  options.limit = limit + 1 // cheap trick

  if (req.query.sort) {
    options.sort = req.query.sort
  }

  if (req.query.skip) {
    options.skip = req.query.skip
  }

  // Count
  if (req.query.count) {
    return req.c.find(selector, options)
      .count(function process(err, count) {
        if (err) return res.error(err)
        res.send({count:count})
      })
  }

  // CountBy
  if (req.query.countBy) return aggregateBy('countBy', req.query.countBy)

  // Regular find
  return req.c.find(selector, options).toArray(getLookups)

  // Check query
  function checkQuery(q) {
    return q
  }

  // Minimal agregration using mongo's map-reduce with inline (in-memory) result collections
  function aggregateBy(agg, groupOn) {
    // TODO: require admin credentials to run countBy queries?
    if (!req.model.schema.paths[groupOn]) {
      return res.error(new HttpErr(httpErr.badParam,
          [agg, groupOn, 'must be a key in the collection']))
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
    req.c.mapReduce(map, reduce, options, function(err, docs) {
      if (err) return res.error(err)
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
      return getLookups(null, results)
    })
  }

  // Populate lookups
  function getLookups(err, docs) {
    if (err) return res.error(err)
    if (!req.query.lookups) return sendResults(err, docs)
    Object.keys(req.model.schema.refParents).forEachAsync(function(ref) {
      var idMap = {}
    }, sendResults(err, docs))
  }

  function sendResults(err, docs) {
    if (err) return res.error(err)
    checkMore(docs, limit)
    var body = {
      data: docs,
      count: docs.length,
      more: moreRecords,
    }
    return res.send(body)
  }

  function checkMore(docs, limit) {
    if (docs.length > limit) {
      docs.pop()
      moreRecords = true
    }
  }
}
