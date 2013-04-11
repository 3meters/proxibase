/**
 * routes/photos/index.js
 *
 *  manage photos stored in aws
 */

// aws account admin@3meters.com

var cred = {
  key: 'AKIAIYU2FPHC2AOUG3CA',
  secret: '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',
}


// Data router
exports.addRoutes = function (app) {
  app.get('/photos/?', welcome)
  app.get('/photos/:collection/:id?', find)
  app.post('/photos/:collection', insert)
  app.post('/photos/:collection/:id', update)
  app.delete('/photos/:collection/:id', remove)
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' photos api',
    data: {}
  }
  greeting.docs = config.service.docsUrl + '#photos'
  res.send(greeting)
}

