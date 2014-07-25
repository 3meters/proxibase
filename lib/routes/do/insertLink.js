/*
 * insertLink
 *
 *   This is here for only backward compat.  All its functionality has been composted down into
 *   the _link.js and link.js schemas.
 *
 *   This is exactly equal to calling:
 *
 *   POST:  /data/links?userCred
 *   body: {
 *     data: {
 *       _to: <toId>,
 *       _from: <fromId>,
 *       type: <type>,
 *     },
 *     actionEvent: ...,
 *     activityDateWindow: ...,
 *     log: ...
 *  }
 */


/* Request body template start ========================================= */

var _body = {
  fromId:             {type: 'string', required: true },
  toId:               {type: 'string', required: true },
  type:               {type: 'string', required: true },
  enabled:            {type: 'boolean', default: true },
  actionEvent:        {type: 'string' },
  activityDateWindow: {type: 'number' },      // for testing to override system default
  log:                {type: 'boolean' },
}

/* Request body template end =========================================== */

// Public web service
exports.main = function(req, res) {

  var options = util.clone(req.body)
  var err = scrub(options, _body)
  if (err) return res.error(err)

  var link = {
    _from: options.fromId,
    _to: options.toId,
    type: options.type,
    enabled: options.enabled,
  }
  delete options.fromId
  delete options.toId
  delete options.type
  delete options.enabled

  _.extend(options, req.dbOps)

  db.links.safeInsert(link, options, function(err, savedLink) {
    if (err) return res.error(err)
    res.send(201, {
      data: [savedLink],
      date: util.now(),
      count: 1,
    })
  })
}
