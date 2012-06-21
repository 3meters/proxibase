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
  constants = require('../constants'),
  check = testUtil.check,
  dump = testUtil.dump,
  req = testUtil.getDefaultReq(),
  testOauthId = {
    twitter: 'twitter:606624261'
  },
  jQuerySrc = 'http://code.jquery.com/jquery-1.7.2.min.js',
  baseUri = testUtil.serverUrl,
  log = require('../../lib/util').log


// Update the default user with the oauthId of our test user account on Twitter
// This approximates a user updating their account and validating with a different
// oauth provider

exports.updateDefaultUserOauthId = function(test) {
  req.method = 'post'
  req.uri = baseUri + '/data/users/ids:' + constants.uid1
  req.body = JSON.stringify({ data: {oauthId: testOauthId.twitter } })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.oauthId === testOauthId.twitter, dump(req, res))
    test.done()
  })
}

// Authorize our Twitter test user via oauth
exports.authTwitter = function(test) {

  var
    authPage = __dirname + '/twitterAuth.html',
    authResultsPage = __dirname + '/twitterAuthResults.html'

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
          // At this point twitter has authticated the user
          // With this call we look them up in our database by their oauthID
          // If we find them, we get a 200 and create or update a session
          // If we don't find them, we get a 406

          request(proxAuthRedirectUrl, function(err, res) {
            check(req, res)
            test.done()
          })
        })
      })
    })
  })
}

