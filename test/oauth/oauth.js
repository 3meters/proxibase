/*
 *  Proxibase security basic test
 */

var
  assert = require('assert'),
  fs = require('fs'),
  request = require('request'),
  jsdom = require('jsdom'),
  log = require('../../lib/util').log,
  oauthProviders = require('../../lib/util').statics.oauthProviders
  testUtil = require('../util'),
  check = testUtil.check,
  dump = testUtil.dump,
  // baseUri = testUtil.serverUrl,
  baseUri = 'https://localhost:8043'
  req = testUtil.getDefaultReq(),
  testUser1 = {
    _id: "testId1",
    name: "Test User1",
    email: "foo@bar.com"
  },
  testUserGenId = {
    name: "Test User GenId",
    email: "foo@bar.com"
  }


// Authorize our Twitter test user via oauth
exports.authTwitter = function(test) {
  req.method = 'get'
  req.uri = baseUri + '/signin/twitter'
  request(req, function(err, res) {
    // we should be redirected to a URL containing our twitter application token and secret,
    // then twitter should respond with the twitter user interface login page.  This attempts
    // to log in via the UI to our twitter test account
    fs.writeFileSync(__dirname + '/twitterUserAppAuth.html', res.body)
    jsdom.env(res.body,
      [ 'http://code.jquery.com/jquery-1.7.2.min.js' ],  // get and run jquery
      function(errors, window) {
        var authenticity_token, oauth_token
        window.$('#oauth_form :input').each(function(index, input) {
          if (input.name === 'authenticity_token') authenticity_token = input.value
          if (input.name === 'oauth_token') oauth_token = input.value
        })
        assert(authenticity_token, 'Could not find twitter authenticity_token')
        assert(oauth_token, 'Could not find twitter oauth_token')
        // now pretend we are the testuser and try to log in
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
          // twitter will return a page with redirect in a meta tag that points to
          // our user authtication page.  Dig it out with jquery and call it.
          if (err) assert(false, err)
          log('res.headers', res.headers)
          fs.writeFileSync(__dirname + '/twitterUserAppAuthResult.html', res.body)
          test.done()
        })
      })
  })
}

