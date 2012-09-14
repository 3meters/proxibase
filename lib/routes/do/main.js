
/*
 * methods/main.js -- custom web methods
 */

var util = require('util')
  , db = util.db
  , gdb = util.gdb
  , config = util.config
  , log = util.log
  , methodList = []
  , methods = {
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


for (method in methods) {
  methodList.push(method)
}

// Human-readable json to describe public methods
exports.get = function(req, res) { 
  res.send({
    info: config.service.name + ' custom web methods',
    sample: {
      url: config.service.url + '/do/<methodName>',
      method: 'POST',
      body: {},
    },
    methods: methodList,
    docs: 'https://github.com/georgesnelling/proxibase#webmethods'
  })
}

// Execute public methods
exports.execute = function(req, res) {
  if (!methods[req.methodName]) {
    return res.error(new HttpErr(httpErr.notFound))
  }
  return methods[req.methodName](req, res)
}


// Hello world for custom methods
function echo(req, res) {
  return res.send(req.body)
}



