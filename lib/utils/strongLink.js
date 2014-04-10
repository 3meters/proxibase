/**
 * utils/strongLink
 *
 *   Return true if a link is strong
 */

module.exports = function(link) {
  return (link && 'content' === link.type)
}
