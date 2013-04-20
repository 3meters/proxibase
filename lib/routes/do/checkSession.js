/*
 * checkSession
 * 
 * Calling this and including user and session will trigger validation. If the session
 * isn't valid, a 401 will be returned before this method even runs.
 */
module.exports.main = function(req, res) {

    res.send(200, {
      info: 'Session is valid',
      data: [],
      date: util.now(),
      count: 1,
    })

}