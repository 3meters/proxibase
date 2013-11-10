/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var config = util.config

var places = require('../places') // moved

var methods = {
  echo: echo,
  find: require('./find'),
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
  deleteLink: require('./deleteLink').main,
  moveCandigrams: require('./moveCandigrams').main,
  processCandigrams: require('./processCandigrams').main,
  getActivities: require('./getActivities').main,
  updateBeaconLocation: require('./updateBeaconLocation').main,
  registerInstall: require('./registerInstall').main,
  insertFeedback: require('./insertFeedback').main,
  insertReport: require('./insertReport').main,
  checkSession: require('./checkSession').main,
  checkActivity: require('./checkActivity').main,
  getPlacePhotos: places.getPhotos,                 // deprecated
  getPlaceCategories: places.getCategories,         // deprecated
  getPlacesNearLocation: places.getNearLocation,    // deprecated
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
  if (!methods[method]) return res.error(proxErr.notFound())
  methods[method](req, res)
}


// Hello world for custom methods
function echo(req, res) {
  return res.send(req.body)
}
