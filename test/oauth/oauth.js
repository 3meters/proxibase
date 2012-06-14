/*
 *  Proxibase oauth test
 *
 *    Emulates human ouath workflow.  The test pretends to be a human user 
 *    who askes to be authenticated on our service by an ouath provider -- 
 *    twitter, facebook, google, etc. Web pages returned by the providers
 *    are parsed using jQuery to extract elements necessary to complete 
 *    the authorizaiton workflow. To aid debugging test failures, the source 
 *    of html pages retured by oauth providers are written to files in this folder.
 *
 *    This test is fragile by nature.
 */

var
  assert = require('assert'),
  fs = require('fs'),
  request = require('request'),
  jsdom = require('jsdom'),
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  req = testUtil.getDefaultReq(),
  jQuerySrc = 'http://code.jquery.com/jquery-1.7.2.min.js',
  // baseUri = testUtil.serverUrl,
  baseUri = 'https://localhost:8043', // still dev for now, to switch to test, must have user accounts
                                      // on oauth providers that redirect to the test host on port 8044
  log = require('../../lib/util').log


// Authorize our Twitter test user via oauth
exports.authTwitter = function(test) {

  var
    authPage = __dirname + '/twitterAuth.html',
    authResultsPage = __dirname + '/twitterAuthResults.html'


  log('baseUri', baseUri)
  req.method = 'get'
  req.uri = baseUri + '/signin/twitter'
  request(req, function(err, res) {

    // we should be redirected to a URL containing our twitter application token and secret,
    // then twitter should respond with the twitter user interface login page.  This attempts
    // to log in via the UI to our twitter test account

    fs.writeFileSync(authPage, res.body)  // corpse

    // run jQuery over the UI page asking the user to trust our app
    jsdom.env(res.body, [ jQuerySrc ], function(errors, window) {

      if (errors) throw errors
      var authenticity_token, oauth_token

      window.$('#oauth_form :input').each(function(index, input) {
        if (input.name === 'authenticity_token') authenticity_token = input.value
        if (input.name === 'oauth_token') oauth_token = input.value
      })

      assert(authenticity_token, 'Could not find twitter authenticity_token, see ' + authPage)
      assert(oauth_token, 'Could not find twitter oauth_token, see ' + authPage)

      // Try to login through the UI as our test twitter user

      request({
        uri: 'https://twitter.com/oauth/authenticate',
        method: 'post',
        form: {
          authenticity_token: authenticity_token,
          oauth_token: oauth_token,
          'session[username_or_email]': 'threemeterstest',
          'session[password]': 'doodah'
        }
      }, function(err, res) {

        // If the login succeded twitter will return an page including a redirect 
        // in a header meta tag that points to our user authtication page.  Dig out 
        // that url with jquery and call it.

        var proxAuthRedirectUrl
        if (err) assert(false, err)

        fs.writeFileSync(authResultsPage, res.body)  // corpse

        // Run jQuery over twitter response page our authorization attempt
        jsdom.env(res.body, [ jQuerySrc ], function(errors, window) {
          if (errors) throw errors

          // Find the url twitter plans to redirect the user to
          var selector = 'meta[http-equiv=refresh]'
          var metaTag = window.$(selector).attr('content')
          metaTag.split(';').forEach(function(element) {
            if (element.indexOf('url=') === 0) proxAuthRedirectUrl = element.substr(4)
          })
          assert(proxAuthRedirectUrl, 'Could not extract the auth redirect url from twitter\'s ' +
            'authResult page, see ' + authResultsPage)

          // Call it
          request(proxAuthRedirectUrl, function(err, res) {
            assert(res.statusCode === 406, 'Unexpected status code')
            test.done()
          })
        })
      })
    })
  })
}

