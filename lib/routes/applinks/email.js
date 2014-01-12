/**
 * applinks/email.js
 *
 */

function normalize(applink) {

  if (!applink.appId) return null

  var email = applink.appId.toLowerCase()

  // regex modified from http://www.regular-expressions.info/email.html
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/.test(email)) return null

  applink.name = applink.appId = email
  applink.appUrl = 'mailto:' + email

  return applink
}

exports.normalize = normalize
