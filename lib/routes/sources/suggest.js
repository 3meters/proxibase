/**
 * sources/suggest.js
 *
 *   Given an array of sources of information about a place
 *   suggest new sources.
 *
 *   It is a messy process. Errors are generally logged, not
 *   returned.
 *
 *   The entire process is subject to a caller-provided timeout,
 *   defaulting to 10,000 miliseconds.>>
 *
 *   This could be reconceived as a socket.io streamy thingy
 *   that pings the client with new suggestions as they come
 *   in from various sources.
 */

var process = require('./process')
var async = require('async')
var _timeout = 1000 * 10


// Web service parameter template
var _body = {
  sources: {type: 'array', required: true},
  place:      {type: 'object', default: {}, value: {
    id:       {type: 'string'},
    provider: {type: 'string'},
    name:     {type: 'string'},
    phone:    {type: 'string'},
  }},
  location: {type: 'object'},
  timeout: {type: 'number', default: _timeout},
  includeRaw: {type: 'boolean'}
}


// Public web service
function main(req, res) {

  var err = util.check(req.body, _body, {strict: true})
  if (err) return res.error(err)

  run(req.body, function(err, newSources, raw) {
    if (err) return res.error(err)

    res.send({
      data: newSources,
      raw: req.body.includeRaw ? raw : undefined,
      date: util.now(),
      count: newSources.length,
      more: false
    })
  })
}


// Private trusted method
function run(ops, cb) {

  var scope = {
    sourceMap: {},
    location: ops.location,
    raw: {}
  }
  var sent = false

  // Called with no sources. Make a seed source from the place
  // Can happen if user manually deletes all sources, then calls suggest
  // Consider: New custom place
  // TODO:  providers is now running in parallel as an array
  if (!ops.sources.length && ops.place && ops.place.provider && ops.place.id &&
      _sources[ops.place.provider]) {
    ops.sources.push({
      type:  ops.place.provider,
      id: ops.place.id,
      name: ops.place.name,
    })
  }

  // Nothing to work with
  if (!ops.sources.length) return cb(null, [], {})

  if (ops.includeRaw) scope.raw.targetSources = ops.sources

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('suggestSources timed out and returned incomplete results:', ops)
      finish()
    }
  }, ops.timeout)

  /*
  // Set up the source getter queue
  var getters = async.queue(function(task, cb) {
    if (task && type.isFunction(task.fn)) {
      task.ops = {
        query: task.query,
        sources: sources,
        sourceMap: sourceMap
        raw: ops.includeRaw ? raw : undefined  // for debugging
      }
      delete task.query
      task.fn(task.ops, cb) // run each task
    }
  }, 10)

  getters.drain = finish
  */

  var sourceQ = async.queue(function(source, cb) {
    process(source, scope, cb)
  }, 10)

  sourceQ.drain = finish

  scope.sourceQ = sourceQ  // will this work?

  ops.sources.forEach(function(source) {
    sourceQ.push(source)
  })

  // Normalize
  // async.map(sources, normalize, queueGetters) // normalize never returns errors

  /*
  function queueGetters() {

    sources = dedupe(_.compact(sources)) // non-normalized sources have been set to null
    if (ops.includeRaw) raw.targetsNormalized = util.clone(sources)

    sources.forEach(function(source) {

      sourceMap[source.type + source.id] = true

      switch (source.type) {
        case 'website':
          if (!source.photo) thumbnail.get(source) // fire and forget
          getters.push({fn: webpage.inspect, query: {
            uri: source.id
          }})
          break
        case 'foursquare':
          getters.push({fn: factual.getFactualId, query: {
            namespace: 'foursquare',
            namespace_id: source.id
          }})
          getters.push({fn: facebook.find, query: {
            name: source.name,
            location: ops.location
          }})
          break
        case 'factual':
          getters.push({fn: factual.inspect, query: {
            factual_id: source.id
          }})
          break
        default:
      }
    })
  }
  */


  // Return a copy of sources without duplicates
  // sources does not need to be sorted
  function dedupe(sources) {
    return _.uniq(sources, false, function(source) {
      var id = String(source.id).toLowerCase()
      var _source = _sources[source.type]
      if (_source.noDupes) return source.type
      else return source.type + id
    })
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(sources) {
    sources.forEach(function(source) {
      if (_sources[source.type]) {
        _.extend(source, _sources[source.type].props)
      }
    })
  }

  function sortSources(a, b) {
    if (!(_sources[a.type] && _sources[b.type])) return 0
    return _sources[a.type].sortOrder - _sources[b.type].sortOrder
  }


  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphore
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) logErr(err.stack || err)
    if (!sent) {
      /*
      if (ops.newEntity) {
        // sort old and new together
        sources = sources.concat(newSources)
        sources.sort(sortSources)
      }
      else {
        // sort old after new
        newSources.sort(sortSources)
        sources = sources.concat(newSources)
      }
      */
      var sources = []
      for (var type in sourceMap) {
        for (var id in type) {
          sources.push(sourceMap[type][id])
        }
      }
      sources.sort(sortSources)
      sources = dedupe(sources)
      decorate(sources)
      sent = true
      cb(null, sources, raw)
    }
  }
}

exports.main = main
exports.run = run
