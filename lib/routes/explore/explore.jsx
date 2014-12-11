/** @jsx React.DOM */

var React = require('react')
var QueryForm = require('./queryForm.jsx')
var Layout = require('./layout.jsx')

var Explore = React.createClass({
  render: function() {
    var title = util.config.service.name + ' API Explorer'
    return (
      <Layout title={title}>
        <QueryForm />
      </Layout>
    )
  }
})

module.exports = Explore
