
/*
 * The keys is this directory are used to sign the password hash.
 * If they are modified users will not be able to sign in without
 * resetting their password.
 */

var fs = require('fs')
var path = require('path')

exports.key1 = fs.readFileSync(path.join(__dirname, 'key1'), 'utf8')
exports.key2 = fs.readFileSync(path.join(__dirname, 'key2'), 'utf8')
