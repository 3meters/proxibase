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

var db = util.db
var callService = util.callService
var assert = require ('assert')
var url = require('url')
var request = require('superagent')
var async = require('async')
var cheerio = require('cheerio')
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
var main = function(req, res) {
  var err = util.check(_body, req.body)
  if (err) return res.error(err)
  var options = {
    sources: req.body.sources,
    location: req.body.location,
    timeout: req.body.timeout,
    includeRaw: req.body.includeRaw,
  }
  run(options, function(err, newSources, raw) {
    if (err) return res.error(err)
    newSources.forEach(function(source) {
      util.extend(source, _sources[source.source.statics])
    })
    res.send({
      data: newSources,
      raw: req.body.includeRaw ? raw : undefined,
      date: util.getTime(),
      count: newSources.length,
      more: false
    })
  })
}


// Internal method that can be called directly
var run = function(options, cb) {

  assert(util.type(options.sources) === 'array', 'Invalid call to suggestSources')
  var sources = options.sources
  var location = options.location
  var makeRaw = options.includeRaw
  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var sent = false
  var raw = []
  var getters = []
  var newSources = []

  if (makeRaw) raw.push({targetSources: util.clone(sources)})

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
      logErr('suggestSources timed out and returned incomplete results')
      finish()
    }
  }, timeout)

  async.forEach(sources, util.sources.normalize, queueGetters) // normalize never returns errors

  if (makeRaw) raw.push({targetsNormalized: util.clone(sources)})

  function queueGetters() {
    sources.forEach(function(source) {
      switch (source.source) {
        case 'website':
          // see https://github.com/caolan/async#applyfunction-arguments
          getters.push(async.apply(grovelWebPage, source.id))
          break
        case 'foursquare':
          getters.push(async.apply(getFactualId, {
            namespace: 'foursquare',
            namespace_id: source.id
          }))
          getters.push(async.apply(searchFacebookPlaces, {
            name: source.name,
            location: location
          }))
          break
        case 'factual':
          getters.push(async.apply(getFactualCrosswalk, source.id))
          break
        default:
      }
    })
    // Kick off the suggestion getters in parallel
    async.parallel(getters, finish)
  }

  function getFactualId(query, next) {
    if (!(query.namespace && query.namespace_id)) return next()
    var path = '/t/crosswalk?filters=' + JSON.stringify(query)
    callService.factual(path, function(err, res) {
      if (err) { logErr(err); return next() }
      try { var factualId = res.body.data[0].factual_id }
      catch (e) { logErr(e); return next() }
      getFactualCrosswalk(factualId, next)
    })
  }

  function getFactualCrosswalk(factualId, next) {
    var path = '/t/crosswalk?filters=' + JSON.stringify({factual_id: factualId})
    callService.factual(path, function(err, res) {
      if (err) { logErr(err); return next() }
      try { var data = res.body.data; assert(data.length) }
      catch (e) { logErr(e.stack||e); return next() }

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
      if (makeRaw) raw.push({factualCandidates: util.clone(candidates)})
      async.forEach(candidates, normalize, function() {
        if (makeRaw) raw.push({factualNormalized: util.clone(candidates)})
        next()
      })
    })
  }

  function searchFacebookPlaces(options, next) {
    if (!(options && options.name && options.location
          && options.location.lat && options.location.lng)) {
      return next()
    }
    // Mind-blowing that facebook does not do this
    var noise = ['a', 'the', 'an', '.', ',', '!', ':', 'mr', 'mr.', 'ms', 'ms.']
    var name = String(options.name).toLowerCase().split(' ')
    name = _.difference(name, noise).join(' ')

    var fbOpts = {
      path: '/search',
      query: {
        q: name,
        type: 'place',
        fields: 'location,name,likes,category,website',
        center: options.location.lat + ',' + options.location.lng,
        distance: 1000,
      },
      log: true
    }
    callService.facebook(fbOpts, function(err, res) {
      if (err) { logErr(err.stack||err); return next() }
      try { var data = res.body.data }
      catch (e) { return next() }
      if (!(data && data.length)) return next()

      data.sort(function(a, b) { return b.likes - a.likes })
      var source = {
        source: 'facebook',
        id: data[0].id,
        origin: 'facebook',
      }
      // TODO:  we may have found a website from facebook. If so
      //   We should push that onto the queue of sources and requery
      newSources.push(source)
      if (makeRaw) {
        raw.push({ facebookCandidates: data })
        raw.push({ facebookNormalized: source })
      }
      next()
    })
  }

  function grovelWebPage(uri, next) {

    request.get(uri).end(function(err, sres) {
      if (err) { logErr(err.stack || err); return next() }
      if (!sres.text) return next()

      var candidates = []
      var $ = cheerio.load(sres.text)  // Cheerio is an implementation of the jquery core DOM
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
      if (makeRaw) raw.push({webpageCandidates: util.clone(candidates)})
      async.forEach(candidates, normalize, function() {
        if (makeRaw) raw.push({webpageNormalized: util.clone(candidates)})
        next()
      })
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
  function decorate(sources) {
    sources.forEach(function(source) {
      util.extend(source, _sources[source.source].statics)
    })
  }

  function sortSources(a, b) {
    if (!(_sources[a.source] && _sources[b.source])) return 0
    return _sources[a.source].sortOrder - _sources[b.source].sortOrder
  }


  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) logErr(err.stack || err)
    if (!sent) {
      newSources = dedupe(sources, newSources)
      newSources.sort(sortSources)
      decorate(newSources)
      sent = true
      cb(null, newSources, raw)
    }
  }
}

exports.main = main
exports.run = run
