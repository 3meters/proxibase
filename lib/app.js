
/**
 * Module dependencies.
 */

// Node modules
var fs = require('fs');
var util = require('util');

// Third-party modules
var express = require('express');
var goose = require('mongoose')

// Local modules
var config = require('../config'); // one level up
var routes = require('./routes');

console.log("Start server with config " + util.inspect(config));

var app = module.exports = express.createServer( {
  key: fs.readFileSync(config.web.ssl.keyFilePath),
  cert: fs.readFileSync(config.web.ssl.certFilePath)
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);

app.listen(config.web.port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
