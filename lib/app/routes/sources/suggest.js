/**
 * sources/suggest.js
 *
 *   Given an array of sources of information about a place suggest new sources.
 *   It is a messy process.  Errors are generally logged not returned.
 *
 *   The entire process is subject to a caller provided timeout, defaulting to 10
 *   seconds.  This could be reconceived as a socket.io streamy thingy which pings
 *   the client with new suggestions as they come in from various sources
 */

var normalize = require('./normalize')
var facebook = require('./facebook')
var webpage = require('./webpage')
var factual = require('./factual')
var url = require('url')
var async = require('async')
var _timeout = 1000 * 10
var _sources = util.statics.sources


// Web service parameter template
var _body = {
  sources: {type: 'array', required: true},
  location: {type: 'object'},
  timeout: {type: 'number', default: _timeout},
  includeRaw: {type: 'boolean'}
}


// Public web service
function main(req, res) {
  var err = util.check(_body, req.body, {strict: true})
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


// Internal method that can be called directly
function run(options, cb) {

  var sources = util.clone(options.sources) // safe copy
  if (!type.isArray(sources)) return cb(perr.badType(options.sources, 'array'))
  var location = options.location
  var makeRaw = options.includeRaw
  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var newEntity = options.newEntity || false
  var sent = false
  var raw = {}
  var newSources = []

  if (makeRaw) raw.targetSources = options.sources

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('suggestSources timed out and returned incomplete results:', options)
      finish()
    }
  }, timeout)

  // Set up the source getter queue
  var getters = async.queue(function(task, cb) {
    if (task && type.isFunction(task.fn)) {
      task.options = {
        query: task.query,
        newSources: newSources,  // for incremental adding of sources
        raw: makeRaw ? raw : undefined  // for debugging
      }
      delete task.query
      task.fn(task.options, cb)
    }
  }, 10)

  getters.drain = finish

  // Normalize
  async.map(sources, normalize, queueGetters) // normalize never returns errors

  function queueGetters(err, sources) {
    sources = dedupe(_.compact(sources)) // non-normalized sources have been set to null
    if (makeRaw) raw.targetsNormalized = util.clone(sources)

    sources.forEach(function(source) {
      switch (source.type) {
        case 'website':
          getters.push({fn: webpage.grovel, query: {
            uri: source.id
          }})
          break
        case 'foursquare':
          getters.push({fn: factual.getFactualId, query: {
            namespace: 'foursquare',
            namespace_id: source.id
          }})
          getters.push({fn: facebook.getPlaces, query: {
            name: source.name,
            location: location
          }})
          break
        case 'factual':
          getters.push({fn: factual.getCrosswalk, query: {
            factual_id: source.id
          }})
          break
        default:
      }
    })
  }


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
      if (options.newEntity) {
        // sort old and new together
        sources = sources.concat(newSources)
        sources.sort(sortSources)
      }
      else {
        // sort old after new
        newSources.sort(sortSources)
        sources = sources.concat(newSources)
      }
      sources = dedupe(sources)
      decorate(sources)
      sent = true
      cb(null, sources, raw)
    }
  }
}

exports.main = main
exports.run = run
