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
  req.viewData = req.vewData || {}
  req.viewData.config = config
  req.viewData.user = req.session.user
  next()
}

function showNewAccountForm(req, res, next) {
  res.render('newAccount', req.viewData)
}

function createAccount(req, res, next) {
  var err = scrub(req.body, {
    name: {required: true},
    email: {required: true},
    password: {required: true},
    secret: {required: true},
  })
  if (err) return res.error(err)
  if (req.body.password !== req.body.password2) {
    return res.error(perr.badValue('passwords do not match'))
  }
  util.request
    .post(config.service.uri + '/user/create')
    .send({
      data: {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
      },
      secret: req.body.secret,
      installId: config.service.name,
    })
    .end(function(err, sres, body) {
      if (err) return next(err)
      if (!sres.ok) {
        res.statusCode = sres.statusCode
        res.isHtml = false
        return res.send(body)
      }
      req.session.user = body.user
      req.session.user.session = body.session.key
      res.redirect('/explore')
    })
}

function showSigninForm(req, res, next) {
  req.viewData.title = 'Sign In'
  res.render('signin', req.viewData)
}

// TODO: make signin shareable and call it directly
function signin(req, res, next) {
  util.request.post(config.service.uri + '/auth/signin')
    .send({
      email: req.body.email,
      password: req.body.password,
      installId: config.service.name,
    })
  .end(function(err, sres, body) {
    if (err) return next(err)
    if (!sres.ok) {
      res.isHtml = false
      res.statusCode = sres.statusCode
      return res.send(body)
    }
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
  var cmd, body = req.body
  for (var key in req.body) {
    if (key.match(/^cmd/)) {
      cmd = key
      delete req.body[key]
    }
  }
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
  var queryString = qs.stringify(body)
  if (queryString.length) path += '?' + queryString
  switch(cmd) {
    case 'cmdRunQuery':
      res.isHtml = false
      res.redirect(path)
      break
    case 'cmdShowQuery':
      req.viewData.displayText = util.inspect(body)
      res.render('explore', req.viewData)
      break
    case 'cmdShowJSON': debug('showJson'); break
    default: res.error(perr.serverError('Unexpected explore command', cmd))
  }
}
