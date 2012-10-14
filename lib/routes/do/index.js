/*
 * routes/do/index.js
 *
 *  router for custom web methods
 */

var util = require('util')
  , config = util.config
  , log = util.log

var methods = {
  echo: echo,
  find: require('./find'),
  touch: require('./touch'),
  getEntities: require('./getEntities').main,
  getEntitiesForBeacons: require('./getEntitiesForBeacons').main,
  getEntitiesForUser: require('./getEntitiesForUser').main,
  getEntitiesNearLocation: require('./getEntitiesNearLocation').main,
  getBeaconsNearLocation: require('./getBeaconsNearLocation').main,
  insertEntity: require('./insertEntity').main,
  updateEntity: require('./updateEntity').main,
  updateLink: require('./updateLink').main,
  deleteEntity: require('./deleteEntity').main,
  insertComment: require('./insertComment').main
}


exports.addRoutes = function(app) {
  app.get('/do', welcome)
  app.post('/do/:method', service)
}


// Human-readable json to describe public methods
function welcome(req, res) {
  res.send({
    info: config.service.name + ' custom web methods',
    sample: {
      url: config.service.url + '/do/<methodName>',
      method: 'POST',
      body: {},
    },
    methods: Object.keys(methods),
    docs: 'https://github.com/georgesnelling/proxibase#webmethods'
  })
}

// Execute public methods
function service(req, res) {
  var method = req.params.method
  if (!methods[method]) return res.error(httpErr.notFound)
  methods[method](req, res)
}


// Hello world for custom methods
function echo(req, res) {
  return res.send(req.body)
}



