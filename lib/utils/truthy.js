
// Tests the truthyness of strings for boolean URL query parameters
// accepts 'true', 'yes', or any positive number

var type = require('./').type

module.exports = function(val) {
  if (type.isNumber(val)) return (val > 0) // negative numbers are false, not true
  if (type(val) !== 'string') return (val) // no clue, use defalt javascript
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}

