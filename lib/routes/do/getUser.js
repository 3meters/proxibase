/*
 * getUser
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , log = util.log
  , sreq = util.request // service request (non-aircandi)
  , methods = require('./methods')

exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  if (!(req.body.userId && typeof req.body.userId === 'string')) {
    return res.error(proxErr.missingParam('userId of type string'))
  }

  getUser(req, res)
}

function getUser(req, res) {
  db.users.findOne({_id:req.body.userId}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(proxErr.badValue('userId'))
    req.userdoc = user;
    //doUserDetail(req, res)
    done(req, res)
  })
}

function doUserDetail(req, res) {
  sreq({ 
    uri: util.config.service.url + '/do/find', 
    body: {collection:'actions', countBy:'type', find:{ '_creator':req.userdoc._id }}
  }, 
  function(err, sres, body) {
    if (err) return res.error(err)
    if (!(body.data && body.data.length)) return res.send(404)
    req.userdoc.stats = body.data;
  })
}

function done(req, res) {
    var users = []
    users.push(req.userdoc)

    res.send({
      data: users,
      date: util.getTimeUTC(),
      count: 1,
      more: false
    })
}
