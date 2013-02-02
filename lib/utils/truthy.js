
// Tests the truthyness of strings for boolean URL query parameters
// accepts 'true', 'yes', or any positive number

var type = require('./index').type

module.exports = function(val) {
  if (type(val) !== 'string') return (val)
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}

