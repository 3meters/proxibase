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

var callService = util.callService
var sourceLib = require('./sources')
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

  var sources = util.clone(options.sources) // safe copy
  if (!type.isArray(sources)) return cb(perr.badType(options.sources, 'array'))
  var location = options.location
  var makeRaw = options.includeRaw
  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var newEntity = options.newEntity || false
  var sent = false
  var raw = []
  var newSources = []

  if (makeRaw) raw.push({targetSources: options.sources})

  // Nested async helper so that normalized candidates can be incrementally
  // added to newSources as they are finished before the entire process times out
  // candidates that fail normalization are set to null
  function normalize(candidate, cb) {
    sourceLib.normalize(candidate, function(source) {
      if (source) {
        if (!_sources[source.type]) source.hidden = true
        newSources.push(source)
      }
      cb()
    })
  }

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('suggestSources timed out and returned incomplete results:', options)
      finish()
    }
  }, timeout)

  var grovelWebPage = function(uri, cb) {

    superagent.get(uri).end(function(err, sres) {
      if (err) { logErr(err.stack || err); return cb() }
      if (!sres.text) return cb()

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
            data: {
              origin: 'website',
              originUrl: uri
            }
          })
          return
        }
        for (var source in _sources) {
          // Match if url hostname begins with a known source
          if (urlObj.host && urlObj.host.indexOf(source) >= 0) {
            candidates.push({
              type: source,
              url: urlObj.href,
              data: {
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
        cb()
      })
    })
  }

  var getFactualId = function(query, cb) {
    if (!(query.namespace && query.namespace_id)) return cb()
    var search = {
      path: '/t/crosswalk',
      query: {filters: query}
    }
    callService.factual(search, function(err, res) {
      if (err) { logErr(err); return cb() }
      if (!(res.body && res.body.data && res.body.data.length)) return cb()
      try { var factualId = res.body.data[0].factual_id }
      catch (e) { logErr(e); return cb() }
      getFactualCrosswalk(factualId, cb)
    })
  }

  var getFactualCrosswalk = function(factualId, cb) {
    var search = {
      path: '/t/crosswalk',
      query: {filters: {factual_id: factualId}},
    }
    callService.factual(search, function(err, res, body) {
      if (err) { logErr(err); return cb() }
      var sources = body.data
      if (!(sources && sources.length)) return cb()

      var candidates = []
      sources.forEach(function(source) {
        if (_sources[source.namespace]) {
          candidates.push({
            type: source.namespace,
            id: source.namespace_id,
            url: source.url,
            data: {origin: 'factual'}
          })
        }
      })

      if (makeRaw) {
        raw.push({factualCandidates: _.clone(candidates)})
      }

      async.forEach(candidates, normalize, function() {
        if (makeRaw) raw.push({factualNormalized: candidates})
        cb()
      })
    })
  }
  
  var searchFacebookPlaces = function(options, cb) {

    if (!(options && options.name && options.location
          && options.location.lat && options.location.lng)) {
      return cb()
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

      if (err) { logErr(err.stack||err); return cb() }
      var places = body.data
      if (!(places && places.length)) return cb()

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
            data: {origin: 'facebook'}
          })
        }
      })

      if (makeRaw) raw.push({facebookCandidates: places})
      cb()
    })
  }



  // Set up the source getter queue
  var getters = async.queue(function(task, cb) {
    log('debug q task:', task)
    log('debug q cb:', cb)
    if (task && type.isFunction(task.fn)) {
      task.fn(task.options, cb)
    }
  }, 10)


  getters.drain = finish

  log('debug 1 ' + sources.length)

  // Normalize
  async.forEach(sources, sourceLib.normalize, queueGetters) // normalize never returns errors

  function queueGetters() {
  log('debug 2 ' + sources.length)
    sources = dedupe(_.compact(sources)) // non-normalized sources have been set to null
  log('debug 3 ' + sources.length)
    if (makeRaw) raw.push({targetsNormalized: util.clone(sources)})

    sources.forEach(function(source) {
      switch (source.type) {
        case 'website':
          // see https://github.com/caolan/async#applyfunction-arguments
          // getters.push(async.apply(grovelWebPage, source.id))
          log('debug 4')
          getters.push({fn: grovelWebPage, options: source.id})
          log('debug 4')
          break
        case 'foursquare':
          /*
          getters.push(async.apply(getFactualId, {
            namespace: 'foursquare',
            namespace_id: source.id
          }))
          getters.push(async.apply(searchFacebookPlaces, {
            name: source.name,
            location: location
          }))
          */
          getters.push({fn: getFactualId, options: {
            namespace: 'foursquare',
            namespace_id: source.id
          }})
          getters.push({fn: searchFacebookPlaces, options: {
            name: source.name,
            location: location
          }})
          break
        case 'factual':
          //getters.push(async.apply(getFactualCrosswalk, source.id))
          getters.push({fn: getFactualCrosswalk, options: source.id})
          break
        default:
      }
    })
    // Kick off the suggestion getters in parallel
    // async.parallel(getters, finish)
  }


  // Return a copy of sources without duplicates
  // sources does not need to be sorted
  function dedupe(sources) {
    return _.uniq(sources, false, function(source) {
      var id = String(source.id).toLowerCase()
      return source.type + id
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
    if (!(_sources[a.source] && _sources[b.source])) return 0
    return _sources[a.source].sortOrder - _sources[b.source].sortOrder
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
        // sold old after new
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
