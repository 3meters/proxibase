
// Given a stack trace return a stack trace filtered of most non-app calls

module.exports = function(fullStack) {
  if (typeof fullStack !== 'string') return fullStack
  var lines = []
  fullStack.split('\n').forEach(function(line) {
    if ((line.indexOf('node_modules') < 0)
      && (line.indexOf('events.js') < 0)
      && (line.indexOf('node.js') < 0)
      && (line.indexOf('error.js') < 0)
      ) lines.push(line)
  })
  return lines.join('\n')
}

