/*
 * getUser
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , log = util.log
  , data = require('../data')  
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
    doUserDetail(req, res)
  })
}

function doUserDetail(req, res) {
  req.collection = db.actions
  req.query = {countBy:'type', find:{ '_user':req.userdoc._id }}
  req.method = 'get'  /* To make sure this query works anonymously */

  data.find(req, function(err, results) {
    if (err) return res.error(err)
    req.userdoc.stats = results.data;
    delete req.query
    delete req.collection
    req.method
    done(req, res)
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
