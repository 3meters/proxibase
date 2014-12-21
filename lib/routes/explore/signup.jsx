/** @jsx React.DOM */

var React = require('react')
var Layout = require('./layout.jsx')

var SignupForm = React.createClass({
  render: function() {
    var title = util.config.service.name + ' New Account'
    return (
      <Layout title={title}>
        <h1>{title}</h1>
        <div className="content pad">
          <form key="signup" method="post" action="/v1/explore/signup">
            <div className="row">
              <input className="field" key="name" name="name" placeholder="Name" />
            </div>
            <div className="row">
              <input className="field" key="email" name="email" placeholder="Email" />
            </div>
            <div className="row">
              <input className="field" key="password" name="password" placeholder="Password" type="password" />
            </div>
            <div className="row">
              <input className="field" key="password2" name="password2" placeholder="Password" type="password" />
            </div>
            <div className="row">
              <input className="field" key="secret" name="secret" placeholder="Secret" />
            </div>
            <input type="submit" name="cmdRun" value="Sign up" />
          </form>
        </div>
      </Layout>
    )
  }
})

module.exports = SignupForm
