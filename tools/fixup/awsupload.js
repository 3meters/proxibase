#!env node

/**
 * backup.js:  backup our nightly proxdump to s3
 **/

var knox = require('knox')  // TJ's simple s3 lib
var fs = require('fs')
var path = require('path')
var cli = require('commander')
var util = require('proxutils')
var log = util.log
var logErr = util.logErr


cli
  .option('-f, --file <file>', 'file to backup', String, '/var/backups/prox/proxdump.gz')
  .option('-b, --bucket <bucket>', 'S3 bucket', String, 'aircandi-backups')
  .parse(process.argv)

uploadToS3(cli.file, cli.bucket)

function uploadToS3(filePath, bucket) {

  filePath = filePath || '/var/backups/prox/proxdump.gz'
  bucket = bucket || 'aircandi-backups'
  var timer = util.timer()

  var date = new Date()
  var d = date.getDate()
  var m = date.getMonth() + 1
  var y = date.getFullYear()
  var h = date.getHours()
  var n = date.getMinutes()
  var s = date.getSeconds()
  var tag = '.' + y + '-' + pad(m) + '-' + pad(d) + '.' + pad(h) + ':' + pad(n) + ':' + pad(s)

  function pad(n) { return (n < 10) ? '0' + n : n }
  var fileExtension = path.extname(filePath)
  var fileBaseName = path.basename(filePath, fileExtension)
  var fileName = fileBaseName + tag + fileExtension

  log('Uploading ' + filePath + ' to aws S3 ' + bucket + '/' + fileName)

  var s3 = knox.createClient({
    key: 'AKIAIYU2FPHC2AOUG3CA',
    secret: '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',
    region: 'us-west-2',
    bucket: bucket,
  })

  var headers = {'x-amz-acl': 'public-read'}

  s3.putFile(filePath, fileName, headers, function(err, s3Res) {
    log('S3 upload complete after ' + timer.read())
    if (err) logErr(err)
    if (200 !== s3Res.statusCode) {
      logErr('Amazon S3 returned error code ' + s3Res.statusCode)
      s3Res.pipe(process.stderr) // can log accept streams?
    }
  })
}