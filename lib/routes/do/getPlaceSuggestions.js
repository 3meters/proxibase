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
  web: null,
  name: null,
  phone: null,
  lattitude: 0,
  longitude: 0,
  source: null,
  sourceId: null,
}

var _suggestions = {
  web: [],
  address: [],
  email: [],
  phone: [],
  google: [],
  facebook: [],
  twitter: [],
  yelp: [],
  foursquare: [],
}


exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  var sug = util.clone(_suggestions)
  var params = {}
  for (var param in _params) {
    params[param] = req.body[param] || _params[param]
  }
  var responseSent = false
  var getters = []

  if (params.web) getters.push(grovelWebPage)

  // Kick off the suggestion getters in paralell
  async.parallel(getters, finish)

  /*
   * Start a clock on the total time for the getters to finish
   * Will return whatever suggestions have been collected after
   * the specified time
   */
  var timerId = setTimeout(function() {
    if (!responseSent) {
      log('getSuggestions timed out and returned incomplete results')
      finish()
    }
  }, params.timeout)


  function grovelWebPage(next) {
    request({uri: params.web}, function(err, sres) {
      if (err) log(err.stack || err)
      var $ = cheerio.load(sres.body)  // Cheerio is an implementation of the jquery core DOM
      $('a[href*="facebook.com"]').each(function(i, elem) {
        sug.facebook.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href*="twitter.com"]').each(function(i, elem) {
        sug.twitter.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href*="yelp.com"]').each(function(i, elem) {
        sug.yelp.push({
          href: $(this).attr('href'),
          text: $(this).text(),
        })
      })
      $('a[href^="mailto:"]').each(function(i, elem) {
        sug.email.push({
          email: $(this).attr('href').slice(7),
        })
      })
      next()
    })
  }

  // Finished can be called by either async when the getters array is complete
  // or by the settimeout function, which ever fires first.  Clear the semaphone
  // and send back whatever suggestions we have.
  function finish(err) {
    clearTimeout(timerId)
    if (err) log(err.stack || err)
    if (!responseSent) {
      responseSent = true
      res.send(sug)
    }
  }
}

