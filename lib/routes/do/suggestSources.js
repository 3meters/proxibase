/*
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


// Public web service
exports.main = function(req, res) {

  if (!(req.body && req.body.sources && (util.typeOf(req.body.sources) === 'array'))) {
    return res.error(proxErr.missingParam('sources: [{source: <source>, id: <id>}]'))
  }
  run({
    timeout: req.body.timeout,
    sources: req.body.sources
  }, function(err, newSources) {
    if (err) return res.error(err)
    res.send({ sources: newSources })
  })
}

// Internal method that can be called directly
var run = exports.run = function(options, cb) {

  assert(typeof options.sources !== 'array', 'Invalid call to suggestSources.run')
  var sources = util.clone(options.sources)

  var timeout = options.timeout || _timeout
  if (timeout < 100) timeout *= 1000 // below 100 we figure you meant seconds
  var sent = false
  var getters = []
  var newSources = []
  var cWebsites = 0

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
        cWebsites++
        // https://github.com/caolan/async#applyfunction-arguments
        getters.push(async.apply(grovelWebPage, source.id))
        break
      case 'foursquare':
        getters.push(async.apply(getFactualCrosswalk, source.id))
        break
      default:
    }
  })

  // If there are no websites yet but there is a foursquare source
  // call foursquare looking for grovel websites
  // Probabaly unnecesary depending on prior client calls
  if (!cWebsites) {
    sources.forEach(function(source) {
      if (source.name === 'foursquare') {
        getters.push(getFourSquare(source.id))
      }
    })
  }

  // Kick off the suggestion getters in parallel
  async.parallel(getters, finish)

  function getFourSquare(id, next) {
    callService.foursquare(id, function(err, res, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      try { var url = body.response.venue.url }
      catch (e) { return next() }
      suggest.websites.push(url)
      if (!options.website) {
        options.website = url
        return grovelWebPage(next)
      }
      next()
    })
  }

  function getFactualCrosswalk(foursquareId, next) {
    // get the factualId from the foursquareId
    var query = {
      namespace: 'foursquare',
      namespace_id: foursquareId
    }
    var path = '/t/crosswalk?filters=' + JSON.stringify(query)
    callService.factual(path, function(err, res) {
      if (err) { log(err); return next() }
      try { var factualId = res.body.data[0].factual_id }
      catch (e) { log(e); return next() }
      // We have a factualId, get the details from the global table
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
          // TODO:  filter out sources we don't care about
          newSources.push({
            source: elem.namespace,
            id: elem.namespace_id,
            url: elem.url,
            name: elem.namespace,
            icon: 'source_' + elem.namespace + '.png',
            iconInverse: 'source_' + elem.namespace + '.png'
          })
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
      // Repeating ourselves because we may need to collect different info from each source provider
      $('a[href*="facebook.com"]').each(function(i, elem) {
        newSources.push({
          source: 'facebook',
          id: prune(url.parse($(this).attr('href')).path),
          name: $(this).text(),
          icon: 'source_facebook.png',
          iconInverse: 'source_facebook.png',
        })
      })
      $('a[href*="twitter.com"]').each(function(i, elem) {
        newSources.push({
          source: 'twitter',
          id: '@' + prune(url.parse($(this).attr('href')).path),
          name: $(this).text(),
          icon: 'source_twitter.png',
          iconInverse: 'source_twitter.png',
        })
      })
      $('a[href*="yelp.com"]').each(function(i, elem) {
        newSources.push({
          source: 'yelp',
          id: prune(url.parse($(this).attr('href')).path),
          name: $(this).text(),
          icon: 'source_yelp.png',
          iconInverse: 'source_yelp.png',
        })
      })
      $('a[href^="mailto:"]').each(function(i, elem) {
        newSources.push({
          source: 'email',
          id: url.parse($(this).attr('href')).href.slice(7),
          name: $(this).text(),
          icon: 'source_email.png',
          iconInverse: 'source_email.png',
        })
      })
      next()
    })
  }

  /*
   *  Return a copy of array newSources without duplicates either internally
   *  or in the orginal sources.
   */
  function dedupe(sources, newSources) {
    var concatted = sources.concat(newSources)
    var concattedDeduped = _.uniq(concatted, false, function(source) {
      // see http://underscorejs.org/#uniq
      // this fuction returns the defintion of a duplicate source
      // simple for now
      return source.source + source.id
    })
    return concattedDeduped.slice(sources.length) // prune the original sources from the result
  }

  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function format(suggest) {
    // party on
    suggest = suggest
  }

  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) log(err.stack || err)
    if (!sent) {
      newSources = dedupe(sources, newSources)
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

