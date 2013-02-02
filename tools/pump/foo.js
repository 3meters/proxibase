var genData = require('./genData')

genData({ validate: true }, function(err, results) {
  console.log('I was called back')
  console.log(err)
  console.log(results)
})
