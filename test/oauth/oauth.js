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
var authTwitterOld = function(test) {

  var
    authPage = __dirname + '/twitterOldAuth.html',
    authResultsPage = __dirname + '/twitterOldAuthResults.html'

  req.method = 'get'
  req.uri = baseUri + '/signin/twitter'
  request(req, function(err, res) {

    // We should be redirected to a URL containing our twitter application token and secret,
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

// This is the action tag from facebook when called from dev mode
var fbLoginUri = "https://www.facebook.com/login.php?api_key=451189364910079&skip_api_login=1&display=page&cancel_url=https%3A%2F%2Flocalhost%3A8043%2Fsignin%2Ffacebook%3Ferror_reason%3Duser_denied%26error%3Daccess_denied%26error_description%3DThe%2Buser%2Bdenied%2Byour%2Brequest.&fbconnect=1&next=https%3A%2F%2Fwww.facebook.com%2Fdialog%2Fpermissions.request%3F_path%3Dpermissions.request%26app_id%3D451189364910079%26redirect_uri%3Dhttps%253A%252F%252Flocalhost%253A8043%252Fsignin%252Ffacebook%26display%3Dpage%26response_type%3Dcode%26fbconnect%3D1%26from_login%3D1%26client_id%3D451189364910079&rcount=1"


// Authorize via Facebook
var authFacebook = function(test) {

  var options = {
    provider: 'facebook',
    oauthUri: baseUri + '/signin/facebook',
    //loginUri: 'https://facebook.com/login.php',

loginUri:'https://www.facebook.com/login.php?api_key=123890574419138&skip_api_login=1&display=page&cancel_url=https%3A%2F%2Flocalhost%3A8044%2Fsignin%2Ffacebook%3Ferror_reason%3Duser_denied%26error%3Daccess_denied%26error_description%3DThe%2Buser%2Bdenied%2Byour%2Brequest.&fbconnect=1&next=https%3A%2F%2Fwww.facebook.com%2Fdialog%2Fpermissions.request%3F_path%3Dpermissions.request%26app_id%3D123890574419138%26redirect_uri%3Dhttps%253A%252F%252Flocalhost%253A8044%252Fsignin%252Ffacebook%26display%3Dpage%26response_type%3Dcode%26fbconnect%3D1%26from_login%3D1%26client_id%3D451189364910079&rcount=1',

    authPage: __dirname + '/facebookAuth.html',
    authResultsPage: __dirname + '/facebookAuthResults.html',
    loginFormQuery: '#login_form :input',
    // loginCancel: 'cancel',
    credentials: {
     userNameField: 'email',
     userNameValue: 'george.snellingtest',
     passwordField: 'pass',
     passwordValue: 'foobar1'
    }
  }

  testProvider(options, function(err) {
    test.done()
  })
}



// Authorize via Twitter
exports.authTwitter = function(test) {

  var options = {
    provider: 'twitter',
    oauthUri: baseUri + '/signin/twitter',
    loginUri: 'https://twitter.com/oauth/authenticate',
    authPage: __dirname + '/twitterAuth.html',
    authResultsPage: __dirname + '/twitterAuthResults.html',
    loginFormQuery: '#oauth_form :input',
    loginCancel: 'cancel',
    credentials: {
     userNameField: 'session[username_or_email]',
     userNameValue: 'threemeterstest',
     passwordField: 'session[password]',
     passwordValue: 'doodah'
    }
  }

  testProvider(options, function(err) {
    test.done()
  })
}


// Test each oauth provider
function testProvider(options, callback) {
  var loginForm = {}
  // pretend we are a modern browser, facebook won't talk to us otherwise
  var userAgent = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.6; en-US; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13'

  req.method = 'get'
  req.headers = {'User-Agent': userAgent}
  req.uri = options.oauthUri
  log('uri: ' + req.uri)
  request(req, function(err, res) {

    // we should be redirected to a URL containing our provider application token and secret,
    // then the provider should respond with the its user interface login page.  This attempts
    // to log in via the provider's UI using the credentials of our test account on each provider

    fs.writeFileSync(options.authPage, res.body)  // corpse

    // run jQuery over the UI page asking the user to trust our app
    jsdom.env(res.body, [ jQuerySrc ], function(errors, window) {

      if (errors) throw errors

      window.$(options.loginFormQuery).each(function(index, input) {
        if (input.name && input.value) loginForm[input.name] = input.value
      })

      // Add our known credentials to the form
      loginForm[options.credentials.userNameField] = options.credentials.userNameValue
      loginForm[options.credentials.passwordField] = options.credentials.passwordValue

      // The login form may have a cancel input, if so, delete it
      if (options.loginCancel) delete loginForm[options.loginCancel]

      // Try to login through the UI as our test user
      log('loginForm', loginForm)

      // TODO: get the post URL from the form's action element

      request({
        headers: {'User-Agent': userAgent},
        uri: options.loginUri,
        method: 'post',
        // form: options.loginFormFields
        form: loginForm
      }, function(err, res) {

        // If the login succeded the provider will return an page including a redirect 
        // in a header meta tag that points to our user authtication page.  Dig out 
        // that url with jquery and call it.

        var proxAuthRedirectUrl
        if (err) assert(false, err)

        fs.writeFileSync(options.authResultsPage, res.body)  // corpse

        // Run jQuery over the provider's page responding to our authorization attempt
        jsdom.env(res.body, [ jQuerySrc ], function(errors, window) {
          if (errors) throw errors

          // Find the url that the provider plans to redirect the user to
          var selector = 'meta[http-equiv=refresh]'
          var metaTag = window.$(selector).attr('content')
          assert (metaTag, 'Authentication appears to have failed, oauth provider did not redirect. See ' +
            options.authResultsPage)
          metaTag.split(';').forEach(function(element) {
            if (element.indexOf('url=') === 0) proxAuthRedirectUrl = element.substr(4)
          })
          assert(proxAuthRedirectUrl, 'Could not extract the auth redirect url from ' +
            options.provider + '\'s authResult page, see ' + options.authResultsPage)

          // Call it
          // At this point the provider has authticated the user
          // With this call we look them up in our database by their oauthID
          // If we find them, we get a 200 and create or update a session
          // If we don't find them, we get a 406

          request(proxAuthRedirectUrl, function(err, res) {
            check(req, res)
            callback()
          })
        })
      })
    })
  })
}

