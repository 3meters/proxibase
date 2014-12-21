/** @jsx React.DOM */

var React = require('react')

var Layout = React.createClass({
  render: function() {
    return (
      <html>
        <head>
          <title>{this.props.title}</title>
          <link rel="stylesheet" href="/v1/assets/styles/style.css" />
        </head>
        <body>{this.props.children}</body>
      </html>
    )
  }
})

module.exports = Layout
