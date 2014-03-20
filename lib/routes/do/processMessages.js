/**
 * processMessages
 */

var async = require('async')

/* Request params template start ========================================= */

var _params = {
  returnMessages:       { type: 'boolean', default: false },  // To allow preview and testing
  skipAction:           { type: 'boolean', default: false },  // To allow preview and testing
  log:                  { type: 'boolean', default: false },
}

/* Request params template end ========================================= */

/*
 * Public web service.  Intended only for test via admin credentials
 *   main method is called by task scheduler.
 *   TODO:  write test
 */
module.exports.main = function(req, res) {

  var err = scrub(req.body, _params)
  if (err) return res.error(err)

  var params = util.clone(req.body)
  params.user = req.user
  if ('admin' !== params.user.role) return res.error(perr.badAuth())

  run(params, function(err, messages, activityDate) {
    if (err) return res.error(err)

    messages = messages || []

    var results = {
      data: messages,
      date: activityDate,
      count: messages.length,
      more: false
    }

    res.send(results)
  })
}

/*
 * Internal method that can be called directly
 */
var run = exports.run =  function(params, cb) {

  var err = scrub(params, _params)
  if (err) return done(err)

  params.user = params.user || util.adminUser

  var activityDate = util.now()
  if (params.log) log('activityDate: ' + activityDate)
  var messages = []
  var dbOps = {
    user: params.user || util.anonUser,
    asAdmin: true,
  }

  expire()

  function expire() {

    /* Find messages that should be expired */
    var query = {
      expired: false,
      enabled: true,
      $and: [
        { expirationDate: { $ne: -1 }},
        { expirationDate: { $lte: activityDate }}],
    }

    db.messages.find(query).toArray(function(err, docs) {
      if (err) return done(err)
      if (params.log) log('found to expire: ' + docs.length)

      var expiredCount = 0

      async.forEach(docs, process, finish)

      function process(message, next) {

        expiredCount++

        if (params.returnMessages) {
          messages.push(message)
        }

        if (!params.skipAction) {
          message.expired = true
          db.messages.safeUpdate(message, dbOps, function(err) {
            if (err) return next(err)

            /* Keep link but set to inactive */
            db.links.update({
                _from: message._id,
                type: statics.typeContent,
                toSchema: statics.schemaPlace,
              }, { $set: { inactive: true }}, { safe: true, multi: true }, function(err) {
              if (err) return next(err)
              next()
            })
          })
        }
        else {
          next()
        }
      }

      function finish(err) {
        if (err) return done(err)

        var action = (expiredCount > 0)
          ? ('expired ' + expiredCount + ' messages')
          : 'no messages to expire'

        if (params.log) log('processMessages: ' +  action + ' ' + util.nowFormatted())
        done(err, messages, activityDate)
      }
    })
  }

  function done(err, messages, activityDate) {
    if (params.log) log('done')
    if (err) log(err.stack || err)
    if (cb) cb(err, messages, activityDate)
  }
}
