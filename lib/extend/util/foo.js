
var log = console.log

// Yet another type checker
function getType(val) {
  return ({}).toString.call(val).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}


function getType1(val) {
  return Object.prototype.toString.call(val)
}

var d = new Date('1/1/2000')
var e = new Error('I am an error')
var s = 'foo'
var o = {
  k1: 'v1',
  k2: 99,
  k3: null
}
var n = null
var a = [1, 2, 3]

log(typeof getType(d))
log(getType(e))
log(getType(s))
log(getType(o))
log(getType(n))
log(getType(a))


