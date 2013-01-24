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
    marketUri: 'market://search?q=com.facebook.katana',
  },
  twitter: {
    sortOrder: 3,
    marketUri: 'market://search?q=com.twitter.android',
  },
  gooogleplace: {
    sortOrder: 4,
  },
  foursquare: {
    sortOrder: 5,
    marketUri: 'market://search?q=com.joelapenna.foursquared',
  },
  instagram: {
    sortOrder: 5.5,
    marketUri: 'market://search?q=com.instagram.android',
  },
  email: {
    sortOrder: 5.8,
  },
  yelp: {
    sortOrder: 7,
    marketUri: 'market://search?q=com.yelp.android',
  },
  citysearch: {
    sortOrder: 8,
    marketUri: 'market://search?q=com.citysearch',
  },
  citygrid: {
    sortOrder: 9,
  },
  openmenu: {
    sortOrder: 10,
  },
  opentable: {
    sortOrder: 11,
    marketUri: 'market://search?q=com.opentable',
  },
  tripadvisor: {
    sortOrder: 12,
    marketUri: 'market://search?q=com.tripadvisor.tripadvisor',
  },
  urbanspoon: {
    sortOrder: 13,
    marketUri: 'market://search?q=com.urbanspoon',
  },
  yahoolocal: {
    sortOrder: 14,
    marketUri: 'market://search?q=com.yahoo.mobile.client.android.search',
  },
  zagat: {
    sortOrder: 15,
    marketUri: 'market://search?q=com.google.zagat',
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
    res.send({
    data: newSources,
    date: util.getTimeUTC(),
    count: newSources.length,
    more: false
    })      
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
          if (_sources[elem.namespace]) {
            if (!elem.namespace_id) elem.namespace_id = elem.url
            if (!elem.namespace_id) return
            newSources.push({
              source: elem.namespace,
              id: elem.namespace_id,
              name: elem.namespace,
              url: elem.url,
              icon: 'source_' + elem.namespace + '.png',
              iconInverse: 'source_' + elem.namespace + '.png',
              origin: 'factual',
              marketUri: _sources[elem.namespace].marketUri,
            })
          }
        })
        next()
      })
    })
  }


  function grovelWebPage(uri, next) {
    var waiting = 0
    var sources = {
      'facebook': [],
      'twitter': [],
      'instagram': [],
      'yelp': [],
      'mailto': []
    }

    request({uri: uri, json: false}, function(err, sres, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      if (!body) return next()
      var $ = cheerio.load(body)  // Cheerio is an implementation of the jquery core DOM
      $('a').each(function(i, elm) {
        var href = $(this).attr('href')
        if (!href) return
        var u = url.parse(href)
        if (!u) return
        for (var source in sources) {
          if (u.host && u.host.indexOf(source) > -1) {
            sources[source].push(getPath(u))
          }
          else {
            if (u.protocol && u.protocol.indexOf(source) > -1)  { // for mailto:
              sources[source].push(getPath(u))
            }
          }
        }
      })

      // Get the user name for facebook ids to make sure we don't dupe selecting name and id separately
      sources.facebook.forEach(function(path) {
        var parts = path.split('/')
        var fbId = parts[parts.length -1] // we guess that the last path element is the id
        waiting++
        var options = {
          uri: 'https://graph.facebook.com/' + fbId + '?fields=username',
          json: true
        }
        request(options, function(err, res, body) {
          if (err) {log(err)}
          else {
            if (body && body.username && body.username.length)
            newSources.push({
              source: 'facebook',
              id: body.username,
              name: 'facebook',
              icon: 'source_facebook.png',
              iconInverse: 'source_facebook.png',
              origin: 'website',
              marketUri: _sources['facebook'].marketUri,
            })
          }
          waiting--
          finishGrovelWebPage()
        })
      })

      sources.twitter.forEach(function(path) {
        id = path.split('/')[0]
        id = (id.indexOf('@') === 0) ? id : '@' + id
        if (id.length > 1) {
          newSources.push({
            source: 'twitter',
            id: id,
            name: 'twitter',
            icon: 'source_twitter.png',
            iconInverse: 'source_twitter.png',
            origin: 'website',
            marketUri: _sources['twitter'].marketUri,
          })
        }
      })

      sources.instagram.forEach(function(path) {
        newSources.push({
          source: 'instagram',
          id: path,
          name:'instagram',
          icon: 'source_generic.png',
          iconInverse: 'source_generic.png',
          origin: 'website',
          marketUri: _sources['instagram'].marketUri,
        })
      })

      sources.yelp.forEach(function(path) {
        newSources.push({
          source: 'yelp',
          id: path,
          name: 'yelp',
          icon: 'source_yelp.png',
          iconInverse: 'source_yelp.png',
          origin: 'website',
          marketUri: _sources['yelp'].marketUri,
        })
      })

      sources.mailto.forEach(function(path) {
        newSources.push({
          source: 'email',
          id: path,
          name: 'email',
          icon: 'source_email.png',
          iconInverse: 'source_email.png',
          origin: 'website',
        })
      })
      finishGrovelWebPage()
    })

    function finishGrovelWebPage() {
      if (!waiting) next()
    }
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

// expects a parsed url object
function getPath(u) {
  log(u)
  var path = ''
  if (u.protocol && u.protocol === 'mailto:') {
    path = u.auth + '@' + u.hostname
  }
  else {
    if (u.pathname) {
      // trim leading and trailing slashes
      path = u.pathname.replace(/^\/|\/$/g, '')
    }
  }
  // fix http://twitter.com/#!/joebob
  if (u.host === 'twitter.com' && u.hash && path === '') {
    path = u.hash.slice(3)
  }
  return path
}

