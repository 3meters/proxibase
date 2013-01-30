/**
 * routes/do/suggestSources.js
 *
 *   given an array of sources of infromation about a place suggest new sources
 *   in general, errors are logged but do not returned.
 *
 *   The entire process is subject to a caller provided timeout, defaulting to 10
 *   seconds.  This could be reconceived as a socket.io streamy thingy which pings
 *   the client with new suggestions as they come in from various sources
 */

var util = require('util')
var db = util.db
var log = util.log
var callService = util.callService
var assert = require ('assert')
var url = require('url')
var _ = require('underscore')
var request = require('request')
var async = require('async')
var cheerio = require('cheerio')
var _timeout = 1000 * 10
var _sources = util.statics.sources


// Web service parameter template
var _body = {
  sources: {type: 'array', required: true},
  timeout: {type: 'number', default: _timeout},
}


// Public web service
var main = function(req, res) {
  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)
  var options = {
    sources: req.body.sources,
    timeout: req.body.timeout,
  }
  run(options, function(err, newSources) {
    if (err) return res.error(err)
    newSources.forEach(function(source) {
      util.extend(source, _sources[source.source.statics])
    })
    res.send({
      data: newSources,
      date: util.getTimeUTC(),
      count: newSources.length,
      more: false
    })
  })
}


// Internal method that can be called directly
var run = function(options, cb) {

  assert(util.type(options.sources) === 'array', 'Invalid call to suggestSources.run')
  var sources = util.clone(options.sources)

  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var sent = false
  var getters = []
  var newSources = []

  // Nested async helper so that normalized candidates can be incrementally
  // added to newSources as they are finished before the entire process times out
  function normalize(candidate, cb) {
    util.sources.normalize(candidate, function() {
      if (candidate.source && util.statics.sources[candidate.source]) {
        newSources.push(candidate)
      }
      cb()
    })
  }

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  var timerId = setTimeout(function() {
    if (!sent) {
      log('suggestSources timed out and returned incomplete results')
      finish()
    }
  }, timeout)

  async.forEach(sources, util.sources.normalize, queueGetters) // normalize never returns errors

  function queueGetters() {
    sources.forEach(function(source) {
      switch (source.source) {
        case 'website':
          // see https://github.com/caolan/async#applyfunction-arguments
          getters.push(async.apply(grovelWebPage, source.id))
          break
        case 'foursquare':
          getters.push(async.apply(getFactualCrosswalk, {
            namespace: 'foursquare',
            namespace_id: source.id
          }))
          break
        default:
      }
    })
    // Kick off the suggestion getters in parallel
    async.parallel(getters, finish)
  }

  function getFactualCrosswalk(query, next) {
    assert(query.namespace && query.namespace_id, 'Invalid call to getFactualCrosswalk')
    var path = '/t/crosswalk?filters=' + JSON.stringify(query)
    callService.factual(path, function(err, res) {
      if (err) { log(err); return next() }
      try { var factualId = res.body.data[0].factual_id }
      catch (e) { log(e); return next() }

      // We have a factualId, get the crosswalk entries
      path = '/t/crosswalk?filters=' + JSON.stringify({factual_id: factualId})
      callService.factual(path, function(err, res) {
        if (err) { log(err); return next() }
        try { var data = res.body.data; assert(data.length) }
        catch (e) { log(e); return next() }

        // We have some source candidates
        var candidates = []
        data.forEach(function(elem) {
          if (_sources[elem.namespace]) {
            candidates.push({
              source: elem.namespace,
              id: elem.namespace_id,
              url: elem.url,
              origin: 'factual',
            })
          }
        })

        async.forEach(candidates, normalize, next)
      })
    })
  }


  function grovelWebPage(uri, next) {

    request({uri: uri, json: false}, function(err, sres, body) {
      if (err) { log(err.stack || err); return next() }
      if (!body) return next()

      var candidates = []
      var $ = cheerio.load(body)  // Cheerio is an implementation of the jquery core DOM
      $('a').each(function(i, elm) {
        var href = $(this).attr('href')
        if (!href) return
        var urlObj = url.parse(href)
        if (!urlObj) return
        if (urlObj.protocol && urlObj.protocol.indexOf('mailto:') === 0) {
          var id = urlObj.auth + '@' + urlObj.hostname
          candidates.push({
            source: 'email',
            id: id,
            name: id,
            origin: 'website'
          })
          return
        }
        for (var source in _sources) {
          if (urlObj.host && urlObj.host.indexOf(source) > -1) {
            candidates.push({
              source: source,
              url: urlObj.href,
              origin: 'website'
            })
          }
        }
      })
      async.forEach(candidates, normalize, next)
    })
  }

  // Return a copy of array newSources without duplicates either internally
  // or in the orginal sources.
  function dedupe(sources, newSources) {
    var concatted = sources.concat(newSources)
    var concattedDeduped = _.uniq(concatted, false, function(source) {
      // see http://underscorejs.org/#uniq
      // this fuction returns the defintion of a duplicate source
      var id = String(source.id).toLowerCase()
      return source.source + id
    })
    return concattedDeduped.slice(sources.length) // prune the original sources from the result
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function format(suggest) {
    // party on
    suggest = suggest
  }

  function sortSources(a, b) {
    assert(_sources[a.source] && _sources[b.source], 'Invalid call to sortSources')
    return _sources[a.source].sortOrder - _sources[b.source].sortOrder
  }


  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) log(err.stack || err)
    if (!sent) {
      newSources = dedupe(sources, newSources)
      newSources.sort(sortSources)
      format(newSources)
      sent = true
      cb(null, newSources)
    }
  }
}

exports.main = main
exports.run = run
