/**
 * sources/suggest.js
 *
 *   Given an array of sources of information about a place
 *   suggest new sources.  Sources can be queried from external
 *   services which can provide new source candidates.  These 
 *   candidates might be duplicates of sources we already know 
 *   about, and they might be referred to by different names or 
 *   urls.
 *
 *   It is a messy process. Errors are generally logged, not
 *   returned.
 *
 *   The entire process is subject to a caller-provided timeout,
 *   defaulting to 10,000 miliseconds.
 *
 *   This could be reconceived as a socket.io streamy thingy
 *   that pings the client with new sources as they come
 *   in from various er, sources.
 */

var process = require('./process')
var async = require('async')
var _sources = util.statics.sources
var _timeout = 1000 * 10


// Web service parameter template
var _body = {
  sources: {type: 'array', required: true},
  place:      {type: 'object', default: {}, value: {
    id:       {type: 'string'},
    provider: {type: 'string'},
    name:     {type: 'string'},
    phone:    {type: 'string'},
    location: {type: 'object', value: {
      lat: {type: 'number'},
      lng: {type: 'number'},
    }},
  }},
  timeout: {type: 'number', default: _timeout},
  includeRaw: {type: 'boolean'},
}


// Public web service
function main(req, res) {

  var err = util.check(req.body, _body, {strict: true})
  if (err) return res.error(err)
  req.body.tag = req.tag
  req.body.user = req.user || util.adminUser

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
function run(ops, done) {

  var scope = {
    tag: ops.tag,
    place: ops.place || {},
    user: ops.user,
    sourceMap: {},
    raw: ops.includeRaw ? {} : undefined,
  }
  var sent = false

  // Called with no sources. Make a seed source from the place
  // Can happen if user manually deletes all sources, then calls suggest
  // TODO: New custom place, can do a facebook of foursquare lookup based
  //  on name and lat / lng
  // TODO:  place providers is now running in parallel as an array
  if (!(ops.sources && ops.sources.length)
      && ops.place && ops.place.provider && ops.place.id
      && _sources[ops.place.provider]) {
    ops.sources.push({
      type:  ops.place.provider,
      id: ops.place.id,
      name: ops.place.name,
    })
  }

  // Nothing to work with
  if (!(ops.sources && ops.sources.length)) return done(null, [], {})

  if (ops.includeRaw) scope.raw.initialSources = ops.sources

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  ops.timeout = ops.timeout || _timeout
  if (ops.timeout < 100) ops.timeout *= 1000 // we figure caller meant seconds
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('suggestSources timed out and returned incomplete results:', ops)
      finish()
    }
  }, ops.timeout)

  var sourceQ = async.queue(function(source, cb) {
    process(source, scope, cb)
  }, 10)

  sourceQ.drain = finish

  // When a source is interogated, it may find new source candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  scope.sourceQ = sourceQ

  ops.sources.forEach(function(source) {
    sourceQ.push(source)
  })


  // Return a copy of sources without duplicates. sources does not need
  // to be sorted. This is primarily for multiple sources of the smame
  // type with different urls, but no specified ids.  In those cases we
  // just pick one at random and discard the others.
  function dedupe(sources) {
    return _.uniq(sources, false, function(source) {
      return (source.id) ? source.type + source.id : source.type
    })
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(sources) {
    sources.forEach(function(source) {
      var _source = _sources[source.type]
      if (_source) _.extend(source, _source.props)
      delete source.icon // depricated
      delete source.label // depricated
      delete source.caption // depricated
      for (var key in source) {
        if (type.isNull(source[key])) delete source[key]
      }
    })
  }


  // Sorter
  function sortSources(a, b) {
    if (!(_sources[a.type] && _sources[b.type])) return 0
    return _sources[a.type].sortOrder - _sources[b.type].sortOrder
  }


  // Finished can be called by either async when the getters array is
  // complete or by the settimeout function, which ever fires first.
  // Clear the semaphore and send back whatever sources we have.
  // Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) logErr(err.stack || err)
    if (!sent) {
      var sourceMap = scope.sourceMap
      var sources = []
      for (var type in sourceMap) {
        for (var id in sourceMap[type]) {
          sources.push(sourceMap[type][id])
        }
      }
      sources.sort(sortSources)
      sources = dedupe(sources)
      decorate(sources)
      sent = true
      done(null, sources, scope.raw)
    }
  }
}

exports.main = main
exports.run = run
