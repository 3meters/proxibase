/**
 * /routes/explore/index.js
 *
 * API explorer UI
 */

var config = util.config
var qs = require('qs')

// Data router
/*
exports.addRoutes = function(app) {
  app.all('/explore/?', setDefaults)
  app.get('/explore/newaccount', showNewAccountForm)
  app.post('/explore/newaccount', createAccount)
  app.get('/explore/signin', showSigninForm)
  app.post('/explore/signin', signin)
  app.get('/explore', showQueryForm)
  app.post('/explore', runQuery)
}
*/ 
function setDefaults(req, res, next) {
  res.isHtml = true
  // req.expData is the base object passed to all views, set some defaults
  req.expData = {
    title: config.service.name + ' ' + req.path.slice(1),
    user: req.session.user,
    debug: false,
  }
  next()
}

function showNewAccountForm(req, res, next) {
  res.render('newAccount', req.expData)
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
  delete req.expData.user
  res.render('signin', req.expData)
}

function signin(req, res, next) {
  var svcReq = {
    path: '/auth/signin',
    method: 'post',
    body: {
      email: req.body.email,
      password: req.body.password,
      installId: util.config.name,
    }
  }
  sreq(svcReq, function(err, sres, body) {
    if (err) return next(err)
    req.session.user = body.user
    req.session.user.session = body.session.key
    // req.session.save()
    res.redirect('/')
  })
}

function signout(req, res, next) {
  delete req.session
  // req.session.save()
  res.redirect('/')
}


function showQueryForm(req, res, next) {
  debug('called')
  res.render('query', req.expData)
}

function runQuery(req, res, next) {
  var body = req.body
  debug('req.body', body)
  var clean = true
  ;['sort', 'query', 'links'].forEach(function(key) {
    if (!clean) return
    if (!body[key]) return
    try { body[key] = JSON.parse(body[key]) }
    catch(err) { body[key] = err; clean = false }
    debug('parsed ' + key, body[key])
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
