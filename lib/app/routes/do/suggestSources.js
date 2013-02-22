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
var url = require('url')
var superagent = require('superagent')  // for groveling non-json web pages
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

  if (!type.isArray(options.sources)) return cb(perr.serverError())

  var sources = options.sources
  var location = options.location
  var makeRaw = options.includeRaw
  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var sent = false
  var raw = []
  var getters = []
  var newSources = []

  if (makeRaw) raw.push({targetSources: _.clone(sources)})

  // Nested async helper so that normalized candidates can be incrementally
  // added to newSources as they are finished before the entire process times out
  function normalize(candidate, cb) {
    util.sources.normalize(candidate, function() {
      if (candidate.type && util.statics.sources[candidate.type]) {
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

  if (makeRaw) raw.push({targetsNormalized: _.clone(sources)})

  function queueGetters() {
    sources.forEach(function(source) {
      switch (source.type) {
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
    var search = {
      path: '/t/crosswalk',
      query: {
        filters: {
          factual_id: factualId
        }
      },
    }
    callService.factual(search, function(err, res, body) {
      if (err) { logErr(err); return next() }
      var sources = body.data
      if (!(sources && sources.length)) return next()

      var candidates = []
      sources.forEach(function(source) {
        if (_sources[source.namespace]) {
          candidates.push({
            type: source.namespace,
            id: source.namespace_id,
            data: {
              url: source.url,
              origin: 'factual',
            }
          })
        }
      })

      if (makeRaw) {
        raw.push({factualCandidates: _.clone(candidates)})
      }

      async.forEach(candidates, normalize, function() {
        if (makeRaw) raw.push({factualNormalized: candidates})
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

    callService.facebook(fbOpts, function(err, res, body) {

      if (err) { logErr(err.stack||err); return next() }
      var places = body.data
      if (!(places && places.length)) return next()

      places.sort(function(a, b) { return b.likes - a.likes })

      var maxLikes = places[0].likes || 0
      var minLikes = maxLikes / 10

      places.forEach(function(place) {
        // popularity filter
        if (places.length === 1 || place.likes > minLikes) {
          // TODO:  we may have found a website from facebook. If so
          //   we should push that onto the queue of sources and requery
          newSources.push({
            type: 'facebook',
            id: place.id,
            name: place.name,
            data: {
              origin: 'facebook',
            }
          })
        }
      })

      if (makeRaw) raw.push({facebookCandidates: places})
      next()
    })
  }

  function grovelWebPage(uri, next) {

    superagent.get(uri).end(function(err, sres) {
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
            type: 'email',
            id: id,
            name: id,
            data: {
              origin: 'website'
            }
          })
          return
        }
        for (var source in _sources) {
          // Match if url hostname begins with a known source
          if (urlObj.host && urlObj.host.indexOf(source) >= 0) {
            candidates.push({
              type: source,
              data: {
                url: urlObj.href,
                origin: 'website',
                originUrl: uri
              }
            })
          }
        }
      })
      if (makeRaw) raw.push({webpageCandidates: _.clone(candidates)})
      async.forEach(candidates, normalize, function() {
        if (makeRaw) raw.push({webpageNormalized: _.clone(candidates)})
        next()
      })
    })
  }

  // Return a copy of array newSources without duplicates internally
  // or in the orginal sources
  function dedupe(sources, newSources) {
    var concatted = sources.concat(newSources)
    var concattedDeduped = _.uniq(concatted, false, function(source) {
      var id = String(source.id).toLowerCase()
      return source.type + id
    })
    // prune the original sources from the result
    return concattedDeduped.slice(sources.length)
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(sources) {
    sources.forEach(function(source) {
      source.data = source.data || {}
      _.extend(source.data, _sources[source.type].data)
      // Delete data property if empty?
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
