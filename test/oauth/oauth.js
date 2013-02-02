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

var assert = require('assert')
var fs = require('fs')
var request = require('request')
var cheerio = require('cheerio')
var testUtil = require('../util')
var constants = require('../constants')
var check = testUtil.check
var dump = testUtil.dump
var Req = testUtil.Req
var adminCred = ''
var testOauthId = {
  twitter: 'twitter:606624261'
}
var jQuerySrc = 'http://code.jquery.com/jquery-1.7.2.min.js'
var baseUri = testUtil.serverUrl
var _exports = {}  // for commenting out tests
var log = require('utils').log


// Get admin session and set credentials
exports.getSession = function(test) {
  testUtil.getAdminSession(function(session) {
    adminCred = 'user=' + session._owner + '&session=' + session.key
    test.done()
  })
}


// Update the default user with the oauthId of our test user account on Twitter
// This approximates a user updating their account and validating with a different
// oauth provider

exports.updateDefaultUserOauthId = function(test) {
  var req = new Req({
    uri: '/data/users/' + constants.uid1 + '?' + adminCred,
    body: {data: {oauthId: testOauthId.twitter}}
  })
  request(req, function(err, res) {
    check(req, res)
    assert(res.body.data.oauthId === testOauthId.twitter, dump(req, res))
    test.done()
  })
}


// Authorize via Twitter
exports.authTwitter = function(test) {

  var options = {
    provider: 'twitter',
    oauthUri: baseUri + '/auth/signin/twitter',
    authPage: __dirname + '/twitterAuth.html',
    authResultsPage: __dirname + '/twitterAuthResults.html',
    loginFormName: '#oauth_form',
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


exports.authFacebook = function(test) {
  log('nyi')
  test.done()
}

exports.authGoogle = function(test) {
  log('nyi')
  test.done()
}

// Authorize via Facebook
_exports.authFacebook = function(test) {

  var options = {
    provider: 'facebook',
    oauthUri: baseUri + '/auth/signin/facebook',
    authPage: __dirname + '/facebookAuth.html',
    authResultsPage: __dirname + '/facebookAuthResults.html',
    loginFormName: '#login_form',
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


// Test each oauth provider
function testProvider(options, callback) {
  var loginForm = {}
  // pretend we are a modern browser, facebook won't talk to us otherwise
  var userAgent = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.6; en-US; rv:1.9.2.13) ' +
   'Gecko/20101203 Firefox/3.6.13'

  var req = {
    method: 'get',
    headers: {'User-Agent': userAgent},
    uri: options.oauthUri
  }
  log('uri: ' + req.uri)
  request(req, function(err, res) {

    // we should be redirected to a URL containing our provider application token and secret,
    // then the provider should respond with the its user interface login page.  This attempts
    // to log in via the provider's UI using the credentials of our test account on each provider

    fs.writeFileSync(options.authPage, res.body)  // corpse

    var $ = cheerio.load(res.body)
    var jQuerySelectLoginFormInputs = options.loginFormName + ' :input'

    $(jQuerySelectLoginFormInputs).each(function(index, input) {
      var attribs = input.attribs
      if (attribs.name && attribs.value) loginForm[attribs.name] = attribs.value
    })

    // Add our known credentials to the form
    loginForm[options.credentials.userNameField] = options.credentials.userNameValue
    loginForm[options.credentials.passwordField] = options.credentials.passwordValue

    // The login form may have a cancel input, if so, delete it
    if (options.loginCancel) delete loginForm[options.loginCancel]

    // Try to login through the UI as our test user
    log('loginForm', loginForm)

    // Use JQuery to extract the login form's action URI
    var loginFormActionUri = $(options.loginFormName).attr('action')

    request({
      headers: {'User-Agent': userAgent},
      uri: loginFormActionUri,
      method: 'post',
      form: loginForm
    }, function(err, res) {

      // If the login succeded the provider will return an page including a redirect 
      // in a header meta tag that points to our user authtication page.  Dig out 
      // that url with jquery and call it.

      var proxAuthRedirectUrl
      if (err) assert(false, err)

      fs.writeFileSync(options.authResultsPage, res.body)  // corpse

      // Run jQuery over the provider's page responding to our authorization attempt
      var $ = cheerio.load(res.body)

      // Find the url that the provider plans to redirect the user to
      var selector = 'meta[http-equiv=refresh]'
      var metaTag = $(selector).attr('content')
      assert (metaTag, 'Authentication appears to have failed, oauth provider did not redirect. See ' +
        options.authResultsPage)
      switch (options.provider) {
        case 'twitter':
          proxAuthRedirectUrl = metaTag.substr(metaTag.indexOf('url=') + 4)
          break
        case 'facebook':
          // facebook wants to stash a cookie with your login info, and then 
          // read that cookie before performing the redirect.  I don't know 
          // how to get around this at the moment -- disabling the facebook test
          // The following was a guess but it didn't work.  
          // proxAuthRedirectUrl = options.oauthUri + '?code=' + $('#input_new_perms').attr('value')
          break
        default: 
      }
      log('redirecting to ', proxAuthRedirectUrl)
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
}

