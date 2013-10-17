var async = require('async')
var log = console.log

var o = {
  a: 1,
  b: 2,
  c: 3,
}

async.each(Object.keys(o), look, function(err) {
  if (err) log(err)
  else log('finished')
})

function look(val, next) {
  console.log(val)
  next()
}
