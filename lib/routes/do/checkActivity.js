/**
 * checkActivity
 *
 * Fast check for staleness. If a date is not passed in it
 * is treated as null for comparisons.
 */

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:       { type: 'string', required: true },
    activityDate:   { type: 'number' },
    modifiedDate:   { type: 'number' },
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var entityId = req.body.entityId
  var entityIdParsed = util.parseId(entityId)

  if (tipe.isError(entityIdParsed)) {
    return res.error(entityIdParsed)
  }

  db[entityIdParsed.collectionName].findOne({ _id: entityId }, { activityDate: 1, modifiedDate: 1 }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(perr.notFound())

    var activity = false
    if (typeof req.body.activityDate === 'undefined' && doc.activityDate)
      activity = true
    if (!activity)
      activity = (req.body.activityDate && doc.activityDate && doc.activityDate > req.body.activityDate)  // activityDate is initialized/set by activity in linked entities

    var modified = false
    if (typeof req.body.modifiedDate === 'undefined' && doc.modifiedDate)
      activity = true
    if (!activity)
      activity = (req.body.modifiedDate && doc.modifiedDate && doc.modifiedDate > req.body.modifiedDate)

    log('activity: ' + activity)
    log('modified: ' + modified)
    res.send({
      info: 'entity activity: ' + activity + ' modified: ' + modified,
      date: util.now(),
      count: 0,
      data: {
        activity: activity,
        modified: modified,
        activityDate: doc.activityDate,
        modifiedDate: doc.modifiedDate
      },
    })
  })
}

exports.main.anonOk = true
