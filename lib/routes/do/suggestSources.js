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
var assert = require ('assert')
var request = require('request')
var url = require('url')
var cheerio = require('cheerio')
var _ = require('underscore')
var async = require('async')
var _timeout = 1000 * 10


var _suggestions = {
  websites: [],
  addressess: [],
  emails: [],
  phones: [],
  googles: [],
  facebooks: [],
  twitters: [],
  yelps: [],
  foursquares: [],
}

// Public web service
exports.main = function(req, res) {

  if (!(req.body && req.body.sources)) {
    return res.error(proxErr.missingParam('sources'))
  }
  run({
    timeout: req.body.timeout,
    sources: req.body.sources
  }, function(err, suggestions) {
    if (err) return res.error(err)
    res.send({ suggestions: suggestions })
  })
}

// Internal method that can be called directly
var run = exports.run = function(options, cb) {

  assert(typeof options.sources === 'array', 'Invalid call to suggestSources.run')

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
    if (source.name === 'website') {
      cWebsites++
      getters.push(grovelWebSite(source.id))
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
    util.callService.foursquare(id, function(err, res, body) {
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

  function grovelWebPage(uri, next) {
    request({uri: uri, json: false}, function(err, sres, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      if (!body) return next()
      var $ = cheerio.load(body)  // Cheerio is an implementation of the jquery core DOM
      // Repeating myself here because we may need to collect different info from each provider
      $('a[href*="facebook.com"]').each(function(i, elem) {
        suggest.facebook.push({
          url: url.parse($(this).attr('href')),
          text: $(this).text(),
        })
      })
      $('a[href*="twitter.com"]').each(function(i, elem) {
        suggest.twitter.push({
          url: url.parse($(this).attr('href')),
          text: $(this).text(),
        })
      })
      $('a[href*="yelp.com"]').each(function(i, elem) {
        suggest.yelp.push({
          url: url.parse($(this).attr('href')),
          text: $(this).text(),
        })
      })
      $('a[href^="mailto:"]').each(function(i, elem) {
        suggest.email.push({
          url: url.parse($(this).attr('href')),
          email: $(this).attr('href').slice(7),
        })
        log('Suggest email href: ', url.parse($(this).attr('href')))
      })
      next()
    })
  }

  // Remove duplicates in place
  function dedupe(suggest) {
    return suggest // TODO: implement
    for (var source in suggest) {
      suggest[source] = _.uniq(suggest[source], false, function(elem, i) {
        if (elem.url) return elem.url.pathname
        if (elem.email) return elem.email
        return i // no idea, don't dedupe it
      })
    }
  }

  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function format(suggest) {
    log('unformatted: ', suggest)
    var formatted = []
    for (var source in suggest) {
      suggest[source].forEach(function(suggestion) {
        fomatted.push({name: source, id: suggestion.url.path})
      })
    }
    suggest = formatted
    log('formatted:', suggest)
  }

  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) log(err.stack || err)
    if (!sent) {
      dedupe(suggest)
      format(suggest)
      sent = true
      cb(suggest)
    }
  }
}

