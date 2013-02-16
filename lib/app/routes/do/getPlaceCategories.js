/*
 * getPlaceCategories
 *   routes/do/getPlace categories.  Deprecated.  redirects to GET /categories
 */

exports.main = function(req, res) {
  res.redirect('/categories')
}

