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
var request = require('request')
var url = require('url')
var cheerio = require('cheerio')
var _ = require('underscore')
var async = require('async')
var _timeout = 1000 * 10


// Source names should be lowercase
var _sources = {
  website: {
    sortOrder: 1,
  },
  facebook: {
    sortOrder: 2,
  },
  twitter: {
    sortOrder: 3,
  },
  gooogleplace: {
    sortOrder: 4,
  },
  foursquare: {
    sortOrder: 5,
  },
  instagram: {
    sortOrder: 5.5,
  },
  twitter_place: {
    sortOrder: 6,
  },
  yelp: {
    sortOrder: 7,
  },
  citysearch: {
    sortOrder: 8,
  },
  citygrid: {
    sortOrder: 9,
  },
  openmenu: {
    sortOrder: 10,
  },
  opentable: {
    sortOrder: 11,
  },
  tripadvisor: {
    sortOrder: 12,
  },
  urbanspoon: {
    sortOrder: 13,
  },
  yahoolocal: {
    sortOrder: 14,
  },
  zagat: {
    sortOrder: 15,
  },
}

var _body = {
  sources: {type: 'array', required: true},
  timeout: {type: 'number', default: _timeout},
}

// Public web service
exports.main = function(req, res) {
  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)
  var options = {
    sources: req.body.sources,
    timeout: req.body.timeout,
  }
  run(options, function(err, newSources) {
    if (err) return res.error(err)
    res.send({ sources: newSources })
  })
}

// Internal method that can be called directly
var run = exports.run = function(options, cb) {

  assert(util.type(options.sources) === 'array', 'Invalid call to suggestSources.run')
  var sources = util.clone(options.sources)

  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure the caller meant seconds
  var sent = false
  var getters = []
  var newSources = []

  // Start a clock on the total time for the getters to finish
  // Will return whatever suggestions have been collected after
  // the specified time
  var timerId = setTimeout(function() {
    if (!sent) {
      log('suggestSources timed out and returned incomplete results')
      finish()
    }
  }, timeout)

  sources.forEach(function(source) {
    switch (source.source) {
      case 'website':
        // https://github.com/caolan/async#applyfunction-arguments
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
        try {
          var data = res.body.data
          assert(data.length)
        }
        catch (e) { log(e); return next() }
        // We have some results
        data.forEach(function(elem) {
          if (_sources[elem.namespace] && elem.namespace_id) { // filter out sources we don't care about
            newSources.push({
              source: elem.namespace,
              id: elem.namespace_id,
              url: elem.url,
              icon: 'source_' + elem.namespace + '.png',
              iconInverse: 'source_' + elem.namespace + '.png',
              origin: 'factual',
            })
          }
        })
        next()
      })
    })
  }


  function grovelWebPage(uri, next) {
    request({uri: uri, json: false}, function(err, sres, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      if (!body) return next()
      var $ = cheerio.load(body)  // Cheerio is an implementation of the jquery core DOM
      // TODO:  parse the webpage once to get all urls, then load all known URLs into source-specific arrays
      // Repeating ourselves because we may need to collect different info from each source provider
      $('a[href*="facebook.com"]').each(function(i, elem) {
        newSources.push({
          source: 'facebook',
          id: prune(url.parse($(this).attr('href')).path),
          icon: 'source_facebook.png',
          iconInverse: 'source_facebook.png',
          origin: 'website',
        })
      })
      $('a[href*="twitter.com"]').each(function(i, elem) {
        var id = prune(url.parse($(this).attr('href')).path)
        id = (id.indexOf('@') === 0) ? id : '@' + id
        if (id.length > 1) {
          newSources.push({
            source: 'twitter',
            id: id,
            name: id,
            icon: 'source_twitter.png',
            iconInverse: 'source_twitter.png',
            origin: 'website',
          })
        }
      })
      $('a[href*="instagram.com"]').each(function(i, elem) {
        newSources.push({
          source: 'instagram',
          id: prune(url.parse($(this).attr('href')).path),
          icon: 'source_generic.png',
          iconInverse: 'source_generic.png',
          origin: 'website',
        })
      })
      $('a[href*="yelp.com"]').each(function(i, elem) {
        newSources.push({
          source: 'yelp',
          id: prune(url.parse($(this).attr('href')).path),
          icon: 'source_yelp.png',
          iconInverse: 'source_yelp.png',
          origin: 'website',
        })
      })
      $('a[href^="mailto:"]').each(function(i, elem) {
        var id = url.parse($(this).attr('href')).href.slice(7)
        newSources.push({
          source: 'email',
          id: id,
          name: id,
          icon: 'source_email.png',
          iconInverse: 'source_email.png',
          origin: 'website',
        })
      })
      next()
    })
  }


  // Return a copy of array newSources without duplicates either internally
  // or in the orginal sources.
  function dedupe(sources, newSources) {
    var concatted = sources.concat(newSources)
    var concattedDeduped = _.uniq(concatted, false, function(source) {
      // see http://underscorejs.org/#uniq
      // this fuction returns the defintion of a duplicate source
      // simple for now
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


// Remove all leading and trailing slashes from a string
function prune(str) {
  return str.replace(/^\/|\/$/g, '')
}

