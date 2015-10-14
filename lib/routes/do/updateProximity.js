/**
 * updateProximity
 */
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    installId:      { type: 'string', required: true },
    beaconIds:      { type: 'array' },                    // array of strings
    location:       { type: 'object', value: {
      lat:            {type: 'number'},
      lng:            {type: 'number'},
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.beaconIds && !req.body.location) {
    return res.error(proxErr.badValue('Either beaconIds array or location object is required'))
  }

  var params = {
    installId: req.body.installId,
    beaconIds: req.body.beaconIds,
    location: req.body.location,
    tag: req.dbOps.tag,
    test: req.body.test,
  }

  if (req.dbOps.user)
    params.userId = req.dbOps.user._id
  else
    params.userId = util.anonUser._id

  methods.updateInstall(params, function (err, install) {
    if (err) return res.error(err)
    var response = {
      info: 'Install updated',
      count: install ? 1 : 0,
      install: install,
      date: util.now(),
      raw: req.raw,
    }
    res.send(response)
  })
}

exports.main.anonOk = true
