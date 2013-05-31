/**
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */


var db = util.db
var parseId = util.parseId
var mongo = require('../db')
var base = require('./_base')
var linkBase = require('./_link')

var link = { id: '0005' }

exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}