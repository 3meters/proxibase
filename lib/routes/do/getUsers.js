/**
 * getUsers
 */

var _ = require('underscore')
var db = util.db
var data = require('../data')

exports.main = function(req, res) {

    // request body template
  var _body = {
    userIds: {type: 'array', required: true},
  }

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  run(req, { userIds: req.body.userIds }, function(err, users) {
      if (err) return res.error(err)
      res.send({
        data: users,
        date: util.getTimeUTC(),
        count: users.length,
        more: false
      })      
  })
}

var run = exports.run = function(req, options, cb) {

  var parts = {}
  var userIds = options.userIds

  db.users
    .find({ _id:{ $in:userIds }})
    .toArray(function(err, users) {

    if (err) return finish(err)

    if (users.length > 0) {
      parts.users = users
      addUserStats()
    }
    else {
      finish()
    }
  })

  function addUserStats() {
    req.collection = db.actions
    req.query = {countBy:['_user','type'], find:{ '_user':{ $in:userIds }}}
    req.method = 'get'  /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return res.error(err)
      parts.stats = results.data
      addLikeCounts()
    })
  }

  function addLikeCounts() {

    req.collection = db.links
    req.query = { countBy:'_to', find:{ '_to': { $in:userIds }, type: 'like' }}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.likes = results.data
      addLiked()
    })
  }

  function addLiked() {
    if (!req.user) {
      addWatchCounts()
    }
    else {
      db.links.find({ _from:req.user._id, _to:{ $in:userIds }, type:'like' }).toArray(function(err, links) {
        if (err) return finish(err)
        parts.likeLinks = links
        addWatchCounts()
      })
    }
  }

  function addWatchCounts() {
    req.collection = db.links
    req.query = { countBy:'_to', find:{ '_to': { $in:userIds }, type: 'watch' }}
    req.method = 'get'   /* To make sure this query works anonymously */

    data.find(req, function(err, results) {
      if (err) return finish(err)
      parts.watchers = results.data
      addWatched()
    })
  }

  function addWatched() {
    if (!req.user) {
      buildPayload()
    }
    else {
      db.links.find({ _from:req.user._id, _to:{ $in:userIds }, type:'watch' }).toArray(function(err, links) {
        if (err) return finish(err)
        parts.watchLinks = links
        buildPayload()
      })
    }
  }

  function buildPayload() {

    parts.users.forEach(function(user) {

      log('building payload for ' + user._id)

      user.stats = getUserStats(user._id)
      user.likeCount = getLikeCount(user._id)
      user.watchCount = getWatchCount(user._id)

      if (req.user) {
        user.liked = getLiked(req.user._id, user._id)
        user.watched = getWatched(req.user._id, user._id)
        if (user.watched) {
          user.watchedDate = getWatchedDate(req.user._id, user._id)
          user._watcher = req.user._id
        }
      }
    })

    /* Wrap it up */
    finish()

    function getUserStats(userId) {
      var stats = []
      for (var i = 0; i < parts.stats.length; i++) {
        if (parts.stats[i]._user == userId) {
          stats.push({ type: parts.stats[i].type, countBy: parts.stats[i].countBy })
        }
      }
      return stats
    }

    function getLikeCount(userId) {
      for (var i = 0; i < parts.likes.length; i++) {
        if (parts.likes[i]._to === userId) {
          return parts.likes[i].countBy
        }
      }
      return 0
    }

    function getLiked(byUserId, userId) {
      var hit = false 
      parts.likeLinks.forEach(function(likeLink) {
        if (likeLink._from == byUserId && likeLink._to == userId) {
          hit = true
          return
        }
      })
      return hit
    }

    function getWatchCount(userId) {
      for (var i = 0; i < parts.watchers.length; i++) {
        if (parts.watchers[i]._to === userId) {
          return parts.watchers[i].countBy
        }
      }
      return 0
    }

    function getWatched(byUserId, userId) {
      var hit = false 
      parts.watchLinks.forEach(function(watchLink) {
        if (watchLink._from == byUserId && watchLink._to == userId) {
          hit = true
          return
        }
      })
      return hit
    }

    function getWatchedDate(byUserId, userId) {
      var date
      parts.watchLinks.forEach(function(watchLink) {
        if (watchLink._from == byUserId && watchLink._to == userId) {
          date = watchLink.createdDate
          return
        }
      })
      return date
    }
  }

  function finish(err) {
    if (err) log(err.stack || err)
    cb(err, parts.users)
  }
}