/*
 * insertLink: Insert a link and trigger various notifications.
 *
 * Deprecated
 *
 *   Use POST /data/links or POST /data/links/<_link> instead
 *
 *   This maps the previous api to the current api for backward compat
 */


var _body = {
  fromId:               { type: 'string', required: true },
  toId:                 { type: 'string', required: true },
  type:                 { type: 'string', required: true },
  enabled:              { type: 'boolean', default: true },
  linkId:               { type: 'string' },
  actionEvent:          { type: 'string' },
  returnNotifications:  { type: 'boolean', default: false },
  activityDateWindow:   { type: 'number' },                   // for testing to override system default
  forceNotify:          { type: 'boolean', default: false },  // for testing to skip notification spam blocking
  log:                  { type: 'boolean' },
}


// Public web service
exports.main = function(req, res) {

  var options = _.cloneDeep(req.body)
  var err = scrub(options, _body)
  if (err) return res.error(err)

  var link = {
    _id:      options.linkId,  // only set for update
    _from:    options.fromId,
    _to:      options.toId,
    type:     options.type,
    enabled:  options.enabled,
  }

  var linkOps = _.cloneDeep(req.dbOps)
  linkOps.test = options.returnNotifications

  db.links.safeUpsert(link, linkOps, function(err, savedLink, meta) {
    if (err || !savedLink) return res.error(err)

    var response = {
      data: [savedLink],
      count: meta.count,
      date: util.now(),
      deprecated: true,
    }
    if (meta.notifications) response.notifications = meta.notifications

    res.status(201).send(response)
  })
}
