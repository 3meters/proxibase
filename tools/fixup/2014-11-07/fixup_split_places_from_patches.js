/*
 * - check link from message to place.
 * - delete place if none and owned by system (synthetic).
 */

var async = require('async')
var util = require('proxutils')  // adds prox globals
var log = util.log
var dblib = require('proxdb')
var db

log('Starting...')
dblib.initDb(util.config.db, function(err, db) {

  if (err) {
    logErr(err)
    process.exit(1)
  }
  log('Initialized.')

  var dbOps = {asAdmin: true}
  var countDelete = 0
  var countPlacesWithMessages = 0
  var countPlacesCustom = 0

  fixupPlaces()

  function prune(place, next) {

    if (place._owner === 'us.000000.00000.000.000000') {
      db.links.safeFind({ _to: place._id, fromSchema: 'message' }, dbOps, function(err, links) {
        if (err) return next(err)

        if (links.length === 0) {
          countDelete++
          db.places.safeRemove({ _id: place._id }, dbOps, function(err, count) {
            if (err) return next(err)
            next()
          })
        }
        else {
          countPlacesWithMessages++
          next()
        }
      })
    }
    else {
      countPlacesCustom++
      next()
    }
  }

  function fixupPlaces() {
    log('Creating patches from places...')

    /* Make sure patch collection is empty */
    db.patches.remove(function(err, result) {
      if (err) finish(err)

      db.places.safeEach({}, dbOps, processPlace, fixupLinks)

      function processPlace(place, next) {
        var patch = util.clone(place)
        var id = convertId(patch._id)

        patch._id = id
        patch.schema = 'patch'

        /* Don't want patches owned by the admin */
        if (patch._owner === 'us.000000.00000.000.000000') {
          if (patch.namelc !== 'candipatch tips and tricks') {
            patch._owner = 'us.000000.00000.000.000001'
            /* We don't want patches linked to place to have the same title */
            patch.name = 'Messages'
            patch.category = {
              id: 'general',
              name: 'General',
              photo: {
                source: 'assets.categories',
                prefix: 'img_group.png',
              }
            }
          }
        }
        else {
          patch._owner = place._creator
          patch.category = {
            id: 'general',
            name: 'General',
            photo: {
              source: 'assets.categories',
              prefix: 'img_group.png',
            }
          }
        }


        delete patch.phone
        delete patch.address
        delete patch.postalCode
        delete patch.city
        delete patch.region
        delete patch.country
        delete patch.provider
        delete patch._photoModifier
        delete patch._applinkModifier
        delete patch.applinkDate
        delete patch.locked
        delete patch.signalFence
        delete patch.enabled
        delete patch.subtitle
        delete patch.random

        db.patches.insert(patch, next)
      }
    })

  }

  function fixupLinks() {

    log('Fixing links...')
    db.links.safeEach({}, dbOps, processLink, fixupActions)

    function processLink(link, next) {
      link._to = convertId(link._to)
      link._from = convertId(link._from)
      if (link.toSchema === 'place') {
        link.toSchema = 'patch'
      }
      if (link.fromSchema === 'place') {
        link.fromSchema = 'patch'
      }
      db.links.update({ _id: link._id}, link, next)
    }
  }

  function fixupActions() {

    log('Fixing actions...')
    db.actions.safeEach({}, dbOps, processAction, fixupMessages)

    function processAction(action, next) {
      action._entity = convertId(action._entity)
      if (action._toEntity) {
        action._toEntity = convertId(action._toEntity)
      }
      action.event = action.event.replace('place', 'patch')
      db.actions.update({ _id: action._id}, action, next)
    }
  }

  function fixupMessages() {

    log('Fixing messages...')
    db.messages.safeEach({}, dbOps, processMessage, linkPlaceToPatch)

    function processMessage(message, next) {
      if (message._acl) {
        message._acl = convertId(message._acl)
      }
      db.messages.update({ _id: message._id}, message, next)
    }
  }

  function linkPlaceToPatch() {

    log('Linking patches to places...')
    db.places.safeEach({}, dbOps, linkToPatch, finish)

    function linkToPatch(place, next) {

      /* System place: no patch to link to so delete */
      if (place._owner !== 'us.000000.00000.000.000000') {
        db.places.remove({_id:place._id}, function(err, result){
          if (err) return finish(err)
          next()
        })
      }

      /* Place patch so link */
      else {

        var patchId = place._id.replace('pl', 'pa')
        db.links.safeFindOne( { _from: patchId, _to: place._id, type: 'proximity' }, dbOps, function(err, doc){
          if (err) return finish(err)

          if (!doc) {
            var id = db.links.genId(link)
            var link = {
              _id: id,
              _from: patchId,
              _to: place._id,
              type: 'proximity',
              schema: 'link',
              enabled: true,
              _owner: place._owner,
              _modifier: place._owner,
              _creator: place._owner,
              fromSchema: 'patch',
              toSchema: 'place',
              createdDate: place.createdDate,
              modifiedDate: place.createdDate,
            }
            db.links.insert(link, next)
          }
          else {
            next()
          }
        })
      }
    }
  }

  function convertId(id) {
    if (id && id.substring(0,2) === 'pl') {
      id = id.replace('pl', 'pa')
    }
    return id
  }

  function finish(err) {
    db.close()
    if (err)
      logErr(err)
    else {
      log('All finished!')
    }
  }
})