/** @jsx React.DOM */

var React = require('react')
var Layout = require('./layout.jsx')

var SigninForm = React.createClass({
  render: function() {
    var title = util.config.service.name + ' Sign In'
    return (
      <Layout title={title}>
        <h1>{title}</h1>
        <div className="content">
          <form id="signin" method="post" action="/v1/explore/signin">
            <div className="row">
              <input className="field" id="email" name="email" placeholder="Email" />
            </div>
            <div className="row">
              <input className="field" id="password" name="password" placeholder="Password" type="password" />
            </div>
            <input type="submit" name="cmdRun" value="Sign in" />
          </form>
        </div>
      </Layout>
    )
  }
})

module.exports = SigninForm
