/**
 * lib/routes/explore/index.js
 *
 * API explorer UI
 */

var qs = require('qs')
var config = util.config
var jsonLint = require('durable-json-lint')  // https://github.com/freethenation/durable-json-lint

// Data router
exports.addRoutes = function(app) {
  app.all('/explore*', setDefaults)
  app.get('/explore/signup', showSignupForm)
  app.post('/explore/signup', signup)
  app.get('/explore/signin', showSigninForm)
  app.post('/explore/signin', signin)
  app.get('/explore/signout', signout)
  app.get('/explore/:collection?', showQueryForm)
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

function showSignupForm(req, res) {
  res.render('signup', req.viewData)
}

function signup(req, res, next) {
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
    .post(config.service.uri + '/v1/user/create')
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
      res.redirect('/v1/explore?'  + qs.stringify({
        user: body.user._id,
        session: body.session.key,
      }))
    })
}


function showSigninForm(req, res) {
  req.viewData.title = 'Sign In'
  res.render('signin', req.viewData)
}


function signin(req, res, next) {
  util.request.post(config.service.uri + '/v1/auth/signin')
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
    res.redirect('/v1/explore?' + qs.stringify({
      user: body.user._id,
      session: body.session.key,
    }))
  })
}


function signout(req, res) {
  req.session = null
  res.redirect('/v1/explore')
}


var queryTypes = {
  name: 'string',
  sort: 'string',
  fields: 'string',
  query: 'object',
  skip: 'number',
  limit: 'number',
  refs: 'string',
  datesToUTC: 'boolean',
  links: 'object',
  user: 'string',
  session: 'string',
}


function showQueryForm(req, res) {
  var ops = req.viewData
  ops.title = 'API Explorer'
  ops.query = req.query
  ops.collection = req.params.collection
  ops.findUrl = buildPath(req.params, req.query)
  if (Object.keys(req.query).length) {
    var findQuery = {}
    for (var key in req.query) {
      if (queryTypes[key]) findQuery[key] = req.query[key]
    }
    var queryString = qs.stringify(findQuery)
    if (queryString.length) {
      ops.findUrl += '?' + queryString
      ops.findQuery = findQuery
      ops.displayQuery = util.inspect(findQuery, false, 100)
      ops.displayJSON = JSON.stringify(findQuery)
    }
  }
  res.render('explore', ops)
}


function runQuery(req, res) {
  var key, body = req.body
  for (key in body) {
    if (!body[key]) delete body[key]
  }

  req.params.collection = body.collection
  delete body.collection

  // Try to parse non-json object syntax into json
  // for query params of type array and object
  req.parsedQuery = {}
  var error
  for (key in body) {
    if (!queryTypes[key]) continue
    if ('array' === queryTypes[key] || 'object' === queryTypes[key]) {
      var jsonVal = jsonLint(body[key])
      jsonVal.errors.forEach(inspectJsonLintErrors)
      if (error) return res.error(perr.badValue(key, error))
      req.parsedQuery[key] = JSON.parse(jsonVal.json)
    }
    else req.parsedQuery[key] = body[key]
  }

  function inspectJsonLintErrors(err) {
    if ('fail' === err.status || 'crash' === err.status) error = err
  }

  // Add the session to the query
  if (req.session && req.session.user) {
    req.parsedQuery.user = req.session.user._id
    req.parsedQuery.session = req.session.user.session
  }

  // Set the path
  var path = buildPath(req.params, body)
  var queryString
  var url = path
  if (body.cmdRun) {
    queryString = qs.stringify(req.parsedQuery)
    if (queryString.length) url += '?' + queryString
    res.isHtml = false
    res.redirect(url)
  }
  else {
    // Round-trip the non-parsed values of the form
    delete body.cmdShow
    _.extend(body, req.parsedQuery)
    queryString = qs.stringify(body)
    path = path.replace(/\/find/, '/explore')
    res.redirect(path + '?' + queryString)
  }
}


// Build the path portion of the url
function buildPath(reqParams, options) {
  var path = '/v1/find'
  var cl = options.collection || reqParams.collection
  if (cl) path += '/' + cl
  if (options._id) path += '/' + options._id
  if (tipe.isTruthy(options.count)) {
    path += '/count'
  }
  else if (options.countBy) {
    path += '/count/' + options.countBy
  }
  return path
}
