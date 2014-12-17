/** @jsx React.DOM */

var React = require('react')
var QueryForm = require('./queryForm.jsx')
var Layout = require('./layout.jsx')


var TopBar = React.createClass({
  render: function() {
    var user, cred, logUri, logErrUri
    debug(Object.keys(this))
    debug(Object.keys(this.props))
    if (this.props.user) {
      user = this.props.user
      cred = 'user=' + query.user + '&session=' + query.session
      logUri = config.service.uri + '/v1/admin/log?' + cred
      logErrUri = config.service.uri + '/v1/admin/errlog?' + cred
      return (
        <div className="content">
            Welcome {user.name}{": "}
            <a href="/v1/explore/signout">Sign out</a>{" "}
            <a href={logUri}>View log</a>{" "}
            <a href={logErrUri}>View error log</a>{" "}
        </div>
      )
    } else {
      return (
        <div className="content">
          {this.props}
          <a href="/v1/explore/newaccount">Sign up</a>{" "}
          <a href="/v1/explore/signin">Sign in</a><br /><br />
        </div>
      )
    }
  }
})


var BottomBar = React.createClass({
  render: function() {
    return (
      <div className="content pad">
        <br />
        <a href="https://api.aircandi.com/v1/find">https://api.aircandi.com/v1/find</a>
        <br />
      </div>
    )
  }
})


var Explore = React.createClass({
  render: function() {
    var title = util.config.service.name + ' API Explorer'
    return (
      <Layout title={title}>
        <h1>{title}</h1>
        <TopBar />
        <QueryForm />
        <BottomBar />
      </Layout>
    )
  }
})

module.exports = Explore
