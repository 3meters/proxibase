/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var config = util.config

var places = require('../places') // moved

var methods = {
  getEntities: require('./getEntities').main,
  getEntitiesForEntity: require('./getEntitiesForEntity').main,
  getEntitiesByProximity: require('./getEntitiesByProximity').main,
  replaceEntitiesForEntity: require('./replaceEntitiesForEntity').main,
  insertEntity: require('./insertEntity').main,
  updateEntity: require('./updateEntity').main,
  deleteEntity: require('./deleteEntity').main,
  trackEntity: require('./trackEntity').main,
  untrackEntity: require('./untrackEntity').main,
  insertLink: require('./insertLink').main,
  enableLink: require('./enableLink').main,
  deleteLink: require('./deleteLink').main,
  removeLinks: require('./removeLinks').main,
  getActivities: require('./getActivities').main,
  getMessages: require('./getMessages').main,
  suggestPlaces: require('./suggestPlaces').main,
  updateBeaconLocation: require('./updateBeaconLocation').main,
  registerInstall: require('./registerInstall').main,
  insertDocument: require('./insertDocument').main,
  checkSession: require('./checkSession').main,
  checkActivity: require('./checkActivity').main,
  getPlacePhotos: places.getPhotos,                 // deprecated
  getPlaceCategories: places.getCategories,         // deprecated
  getPlacesNearLocation: places.getNearLocation,    // deprecated
  countLinksTo: require('./countLinks').to,
  countLinksFrom: require('./countLinks').from,
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
      url: config.service.url + '/do/<methodName>',
      method: 'POST',
      body: {},
    },
    methods: Object.keys(methods),
    docs: config.service.docsUrl + '#webmethods'
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

