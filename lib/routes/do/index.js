/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var config = util.config

var methods = {
  echo: echo,
  find: require('./find'),
  touch: require('./touch'),
  getEntities: require('./getEntities').main,
  getEntitiesForLocation: require('./getEntitiesForLocation').main,
  getEntitiesForUser: require('./getEntitiesForUser').main,
  getWatchedForUser: require('./getWatchedForUser').main,
  getPlacesNearLocation: require('./getPlacesNearLocation').main,
  getPlacePhotos: require('./getPlacePhotos').main,
  getPlaceCategories: require('./getPlaceCategories').main,
  getUsers: require('./getUsers').main,
  insertEntity: require('./insertEntity').main,
  updateEntity: require('./updateEntity').main,
  deleteEntity: require('./deleteEntity').main,
  likeEntity: require('./likeEntity').main,
  unlikeEntity: require('./unlikeEntity').main,
  trackEntity: require('./trackEntity').main,
  untrackEntity: require('./untrackEntity').main,
  insertVerbLink: require('./insertVerbLink').main,
  deleteVerbLink: require('./deleteVerbLink').main,
  updateLink: require('./updateLink').main,
  insertComment: require('./insertComment').main,
  unregisterDevice: require('./unregisterDevice').main,
  checkSession: require('./checkSession').main,
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
