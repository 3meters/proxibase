/*
 * db/schemas/_photo.js
 *
 *   photo schema component
 */

var photo = {

  fields: {
    prefix:       { type: 'string', required: true },       // can be full path or partial path to be combined with suffix
    suffix:       { type: 'string|null' },
    width:        { type: 'number|null' },
    height:       { type: 'number|null' },
    /*
     *  Valid sources:
     * - aircandi.images: stored by us in s3 for entities other than users
     * - aircandi.users: stored by us in s3 for user profiles
     * - assets.categories: stored by us in service assets tree
     * - foursquare: stored with foursquare
     * - google: stored with google
     * - yelp: stored with yelp
     * - resource: stored as embedded client application resource
     * - generic: stored at third party internet server
     */
    source:       { type: 'string', required: true },
    createdDate:  { type: 'number|null' },                  // date photo was created when source provides it
  }
}

module.exports = (function() {
  return photo
})()
