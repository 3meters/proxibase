/**
 * suggest/thumb.js
 *
 *    get a thumbnail image of a website
 *    store it on s3
 *    set the picture property of the source to our saved image
 */

var fs = require('fs')
var aws = require('aws-sdk')
aws.config.update({
  accessKeyId: 'AKIAIYU2FPHC2AOUG3CA',
  secretAccessKey: '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',
})


var rs = fs.createReadStream(__dirname + '/thumb.jpeg')

var s3 = new aws.S3()
var options = {
  Bucket: 'aircandi.thumbnails',
  Key: 'www.amazon.com.jpg',
}
var ws = s3.client.putObject(options).createWriteStream()
rs.pipe(ws)

ws.on('error', function(err) {console.log(err)})

ws.on('finished', function() {
  console.log('it worked')
})
