/*
 * routes/do/buildNotification.js
 *
 * Build the Human-readable text of a notification message from a notification
 *   object
 *
 *   Author: Jay
 *   Maintainer: George
 *
 */

module.exports = function(options) {

  var _options = {
    event:        { type: 'string', required: true },
    trigger:      { type: 'string', required: true },
    priority:     { type: 'number', required: true },
    to:           { type: 'object', required: true },
    from:         { type: 'object' },
    link:         { type: 'object' },
    deviceTarget: { type: 'string' },
    provider:     { type: 'string' },
  }

  var err = scrub(options, _options)

  if (err) {
    logErr('Invalid call to push.buildNotification: ', err)
    return err
  }
  /*
   * The notification has to provide enough context to be shown
   * in a list. Additional context can come from linked entities.
   */
  var admin = { _id: util.adminId, name: 'Patch' }
  var privacy
  var summary
  var notification = {
    schema: 'notification',
    summary: 'notification',
    event: options.event,
    trigger: options.trigger,
    _creator: admin._id,
    _modifier: admin._id,
    creator: admin,
    modifier: admin,
    createdDate: options.to.createdDate,
    modifiedDate: options.to.modifiedDate,
    priority: options.priority,
    subtitle: 'subtitle', // to protect client versions that don't expect this to ever be null
  }

  if (options.link) {
    _.assign(notification, _.pick(options.link, ['createdDate', 'modifiedDate']))
  }

  // Android client expects this value, but I don't think it has any meaning
  notification.sortDate = notification.modifiedDate

  if (options.event === 'watch_entity_patch') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> joined your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.summary
    }
    else return perr.serverError('Invalid notification: ', notification)
  }

  else if (options.event === 'request_watch_entity') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> wants to join your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = util.format('<b>%s</b> wants to join your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
    }
  }

  else if (options.event === 'approve_watch_entity') {
    /*
     * [user] -> watch -> [patch]
     */
    notification.type = 'watch'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> joined your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.photo = options.from.photo
      notification.userId = options.from._id
    }
    else if (options.trigger === 'own_from') {
      notification.summary = util.format('<b>%s</b> approved your request to join %spatch <b>%s</b>', options.to.creator.name, privacy, options.to.name)
      notification.ticker = notification.summary
      notification.name = options.to.creator.name
      notification.photo = options.to.creator.photo
      notification.userId = options.to.creator._id
    }
  }

  else if (options.event === 'like_entity_patch') {
    /*
     * [user] -> like -> [patch]
     */
    notification.type = 'like'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.userId = options.from._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'own_to') {
      notification.summary = util.format('<b>%s</b> favorited your %spatch <b>%s</b>', options.from.name, privacy, options.to.name)
      notification.ticker = notification.summary
    }
  }

  else if (options.event === 'like_entity_message') {
    /*
     * [user] -> like -> [message]
     */
    notification.type = 'like'
    notification.name = options.from.name
    notification.id = options.link._id.replace('li', 'no')
    notification._target = options.to._id
    notification.photo = options.from.photo
    notification.userId = options.from._id

    if (options.trigger === 'own_to') {
      if (options.to.photo && !options.to.description) {
        notification.summary = util.format('<b>%s</b> liked your photo', options.from.name)
        notification.subtitle = 'Liked your photo'
        notification.ticker = notification.summary
        notification.photoBig = options.to.photo
      }
      else {
        notification.summary = util.format('<b>%s</b> liked your message: "%s"', options.from.name, options.to.description)
        notification.ticker = notification.summary
      }
    }
  }

  else if (options.event === 'insert_entity_patch') {
    /*
     * [empty] -> empty -> [patch]
     * [user] -> create -> [patch]
     */
    notification.type = 'patch'
    notification.name = options.to.creator.name
    notification.id = 'no' + options.to._id.substring(2)
    notification._target = options.to._id
    notification.photo = options.to.creator.photo
    notification.photoBig = options.to.photo
    notification.userId = options.to.creator._id

    privacy = (options.to.visibility === 'public') ? '' : 'private '
    if (options.trigger === 'nearby') {
      notification.summary = util.format('<b>%s</b> created the %spatch <b>%s</b> nearby', options.to.creator.name, privacy, options.to.name)
      notification.subtitle = util.format('Created the %spatch <b>%s</b> nearby', privacy, options.to.name)
      notification.ticker = notification.summary
      notification.priority = 1
    }
  }

  else if (options.event.indexOf('insert_entity_message') === 0) {
    /*
     * [message[creator]] -> content -> [patch]
     * [message[creator]] -> content -> [message]
     */
    notification.type = 'message'
    notification.name = options.from.creator.name
    notification.id = 'no' + options.from._id.substring(2)
    notification._target = options.from._id
    notification._parent = options.to._id
    notification.photo = options.from.creator.photo
    notification.photoBig = options.from.photo
    notification.ticker = 'Message from Patchr'
    notification.userId = options.from.creator._id

    if (options.event === 'insert_entity_message_share') {
      /*
       * [message[creator]] -> share -> [user]
       */
      notification.type = 'share'
      notification.trigger = 'share'
      if (options.from.photo) {
        notification.summary = util.format('<b>%s</b> shared a photo with you', options.from.creator.name)
        notification.ticker = notification.summary
        notification.subtitle = 'Shared with you'
      }
      else {
        notification.summary = util.format('<b>%s</b> shared with you: "%s"', options.from.creator.name, options.from.description)
        notification.ticker = notification.summary
        notification.description = options.from.description
        notification.subtitle = 'Shared with you'
      }
    }
    else {

      /* Message to a patch */
      var context = (options.from.photo) ? 'photo' : 'message'
      notification.subtitle = util.format('<b>%s</b> patch', options.to.name)

      if (options.trigger === 'nearby') {
        summary = '<b>%s</b> posted a %s to a nearby patch <b>%s</b>'
        if (options.from.description) {
          notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          notification.description = options.from.description
        }
        else {
          notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
        }

        notification.priority = 1
      }
      else if (options.trigger === 'watch_to') {
        summary = '<b>%s</b> posted a %s to patch <b>%s</b>'
        if (options.from.description) {
          notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          notification.description = options.from.description
        }
        else {
          notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
        }
      }
      else if (options.trigger === 'own_to') {
        summary = '<b>%s</b> posted a %s to your patch <b>%s</b>'
        if (options.from.description) {
          notification.summary = util.format(summary += ': "%s"', options.from.creator.name, context, options.to.name, options.from.description)
          notification.description = options.from.description
        }
        else {
          notification.summary = util.format(summary, options.from.creator.name, context, options.to.name)
        }
      }
      if (options.from.photo)
        notification.type = 'media'
    }
  }


  /*
   * Final transform based on device target.
   * Max size by deviceTarget: android: 4096, ios: 2048,
   * The device target is pulled from the install record.
   */
  if (options.deviceTarget === 'ios') {

    var ios_notification = {
      alert: '',
      badge: 'Increment',
      sound: 'chirp.caf',
      'content-available': '1',         // required so app will receive even if in the background or stopped
      id: notification.id,
      targetId: notification._target,
      parentId: notification._parent,
      event: notification.event,        // watch_entity_patch, etc
      trigger: notification.trigger,    // nearby|own_to|watch_to|share
      priority: notification.priority,
      photo: notification.photo,
      name: notification.name,
      userId: notification.userId,
      description: notification.description,
      subtitle: notification.subtitle,
      createdDate: notification.createdDate,
      modifiedDate: notification.modifiedDate,
    }

    var wrapperSize = 56 // Parse adds aps subdictionary and overhead like device token and message length
    var payloadMaxSize = 2048
    var maxSize = (payloadMaxSize - wrapperSize)
    var remaining = maxSize - JSON.stringify(ios_notification).length
    var alert = notification.summary.replace(new RegExp('<b>|</b>', 'g'), '\"')  // Strips bolding markup because ios doesn't support it
    ios_notification.alert = alert.substring(0, remaining)   // truncate the alert if needed to fit within size limit

    // Mute priority 2 and higher notifications
    // See https://github.com/3meters/proxibase/issues/347
    if (options.priority > 1) {
      ios_notification["alert-x"] = ios_notification.alert
      ios_notification["sound-x"] = ios_notification.sound
      delete ios_notification.alert
      delete ios_notification.sound
    }

    notification = ios_notification
  }

  /*
   * Remap to schema expected by OneSignal.
   */
  if (options.provider === 'one_signal') {
		  var one_signal_notification = {
		    contents: { 'en': notification.summary },
		    data: {
		      targetId: notification._target,
		      parentId: notification._parent,
		      event: notification.event,
		      trigger: notification.trigger,
		      priority: notification.priority,
		    },
		  }
		  if (notification.photoBig) {
		    one_signal_notification.big_picture = 'http://aircandi-images.s3.amazonaws.com/' + notification.photoBig.prefix
		  }

		  notification = one_signal_notification
  }

  return notification
}
