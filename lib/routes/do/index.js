/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var config = util.config

var methods = {
  updateProximity: require('./updateProximity').main,
  registerInstall: require('./registerInstall').main,
}


// Public routes
exports.addRoutes = function(app) {
  app.get('/do', welcome)
  app.get('/do/:method', service)
  app.post('/do/:method', service)
}

// Human-readable json to describe public methods
function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' custom web methods',
    sample: {
      uri: config.service.urlExternal + '/' + config.service.defaultVersion + '/do/<methodName>',
      method: 'POST',
      body: {},
    },
    methods: Object.keys(methods),
    docs: config.service.docsUri + '#webmethods'
  }
  res.send(greeting)
}


// Execute public methods
function service(req, res) {
  var method = req.params.method
  if (!methods[method]) return res.error(perr.notFound())
  if (!req.user && !methods[method].anonOk) return res.error(perr.badAuth())
  if (req.user && util.anonId === req.user._id && !methods[method].anonOk) return res.error(perr.badAuth())
  methods[method](req, res)
}

