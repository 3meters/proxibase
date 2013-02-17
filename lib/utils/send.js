/**
 * utils/send.js
 *
 * Funtions that return data based on a request can use this helper
 * to accept either a callback or a response object like so:
 *
 *  function getData(req, arg) {
 *    var callback = (typeof arg === 'function') ? arg : util.send(arg)
 *    ...
 *    if (err) return callback(err)
 *    ...
 *    callback(null, results)
 *  }
 *
 *  This could go away if we got rid of response.error and made res.send
 *  handle errors internally
 */
module.exports = function(res) {
  return function(err, results) {
    if (!(res.send && res.error)) throw new Error('Invalid call to send')
    if (err) return res.error(err, results)
    else return res.send(results)
  }
}


