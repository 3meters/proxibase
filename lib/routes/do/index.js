/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var config = util.config

var methods = {
  getEntities: require('./getEntities').main,
  getEntitiesForEntity: require('./getEntitiesForEntity').main,
  getEntitiesByProximity: require('./getEntitiesByProximity').main,
  getNotifications: require('./getNotifications').main,
  insertDocument: require('./insertDocument').main,
  insertEntity: require('./insertEntity').main,
  insertLink: require('./insertLink').main,
  updateEntity: require('./updateEntity').main,
  deleteEntity: require('./deleteEntity').main,
  deleteLink: require('./deleteLink').main,
  trackEntity: require('./trackEntity').main,
  untrackEntity: require('./untrackEntity').main,
  removeLinks: require('./removeLinks').main,
  registerInstall: require('./registerInstall').main,
  replaceEntitiesForEntity: require('./replaceEntitiesForEntity').main,
  checkSession: require('./checkSession').main,
  checkActivity: require('./checkActivity').main,
  checkShare: require('./checkShare').main,
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
      uri: config.service.uri + '/v1/do/<methodName>',
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

