/**
 * /routes/explore/index.js
 *
 * API explorer UI
 */

var qs = require('qs')
var config = util.config
// var serviceSignin = require('../auth').signin

// Data router
exports.addRoutes = function(app) {
  app.all('/explore*', setDefaults)
  app.get('/explore/newaccount', showNewAccountForm)
  app.post('/explore/newaccount', createAccount)
  app.get('/explore/signin', showSigninForm)
  app.post('/explore/signin', signin)
  app.get('/explore/signout', signout)
  app.get('/explore', showQueryForm)
  app.post('/explore', runQuery)
}


function setDefaults(req, res, next) {
  res.isHtml = true
  // req.viewData is the base object passed to all views, set some defaults
  req.viewData = {
    config: config,
    user: req.session.user,
    debug: false,
  }
  next()
}

function showNewAccountForm(req, res, next) {
  res.render('newAccount', req.viewData)
}

function createAccount(req, res, next) {
  var secret = req.body.secret
  delete req.body.secret
  var svcReq = {
    path: '/user/create',
    method: 'post',
    body: {data: req.body, secret: secret},
    user: req.session.user
  }
  sreq(svcReq, function(err, sres, body) {
    if (err) return next(err)
    req.session.user = body.user
    req.session.user.sessionKey = body.session.key
    // req.session.save()
    res.redirect('/')
  })
}

function showSigninForm(req, res, next) {
  req.viewData.title = 'Sign In'
  res.render('signin', req.viewData)
}

// TODO: make signin shareable and call it directly
function signin(req, res, next) {
  debug(config)
  if (config && config.service
      && ('development' === config.service.mode
          || 'test' === config.service.mode)) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
  }
  util.request.post(config.service.uri + '/auth/signin')
    .send({
      email: req.body.email,
      password: req.body.password,
      installId: config.service.name,
    })
  .end(function(err, sres, body) {
    if (err) return next(err)
    req.session.user = body.user
    req.session.user.session = body.session.key
    res.redirect('/explore')
  })
}

function signout(req, res, next) {
  delete req.session
  res.redirect('/explore')
}

function showQueryForm(req, res, next) {
  req.viewData.title = 'API Explorer'
  res.render('explore', req.viewData)
}

function runQuery(req, res, next) {
  var body = req.body
  var clean = true
  ;['sort', 'query', 'links'].forEach(function(key) {
    if (!clean) return
    if (!body[key]) return
    try { body[key] = JSON.parse(body[key]) }
    catch(err) { body[key] = err; clean = false }
  })
  if (!clean) return res.send(400, body)
  var path = '/find/' + body.collection
  if (body._id) path += '/' + body._id
  if (tipe.truthy(body.count)) {
    path += '/count'
  }
  delete body.count
  delete body.collection
  delete body._id
  if (req.session && req.session.user) {
    body.user = req.session.user._id
    body.session = req.session.user.session
  }
  for (var key in body) {
    if (!body[key]) delete body[key]   // do we ever need to pass in falsey values?
  }
  res.isHtml = false
  var queryString = qs.stringify(body)
  if (queryString.length) path += '?' + queryString
  res.redirect(path)
}
