/*
 * getPlaceSuggestions
 */

var util = require('util')
var db = util.db
var log = util.log
var request = require('request')
var cheerio = require('cheerio')
var async = require('async')

var _params = {
  timeout: 1000 * 10,  // max time allowed to fulfill request
  website: null,
  name: null,
  address: null,
  phone: null,
  lattitude: 0,
  longitude: 0,
  source: null,
  sourceId: null,
}

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


exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  var suggest = util.clone(_suggestions)
  var params = util.clone(_params, req.body)
  var responseSent = false
  var getters = []

  // Start a clock on the total time for the getters to finish
  // Will return whatever suggestions have been collected after
  // the specified time
  var timerId = setTimeout(function() {
    if (!responseSent) {
      log('getSuggestions timed out and returned incomplete results')
      finish()
    }
  }, params.timeout)

  if (params.source === 'foursquare' && params.sourceId) {
    getters.push(getFourSquare)
  }
  if (params.website) getters.push(grovelWebPage)

  // Kick off the suggestion getters in parallel
  async.parallel(getters, finish)

  function getFourSquare(next) {
    util.callService.foursquare(params.sourceId, function(err, res, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      try { var url = body.response.venue.url }
      catch (e) { return next() }
      suggest.websites.push(url)
      if (!params.website) {
        params.website = url
        return grovelWebPage(next)
      }
      next()
    })
  }

  function grovelWebPage(next) {
    request({uri: params.website, json: false}, function(err, sres, body) {
      if (err) {
        log(err.stack || err)
        return next()
      }
      if (!body) return next()
      var $ = cheerio.load(body)  // Cheerio is an implementation of the jquery core DOM
      $('a[href*="facebook.com"]').each(function(i, elem) {
        suggest.facebook.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href*="twitter.com"]').each(function(i, elem) {
        suggest.twitter.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href*="yelp.com"]').each(function(i, elem) {
        suggest.yelp.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href^="mailto:"]').each(function(i, elem) {
        suggest.email.push({
          email: $(this).attr('href').slice(7),
        })
      })
      next()
    })
  }

  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have. Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) log(err.stack || err)
    if (!responseSent) {
      responseSent = true
      res.send(suggest)
    }
  }
}

