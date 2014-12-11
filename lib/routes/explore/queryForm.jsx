/** @jsx React.DOM */

var React = require('react')

var defaultField = {
  key:   '',
  name: '',
  type: 'string',
  input: null,  // or component
  patchholder: '',
  help: '',
}

var fields = {
  collection: {},
  _id: {},
  fields: {},
  name: {},
  query: {},
  sort: {},
  refs: {},
  links: {},
  skip: {},
  limit: {},
  datesToUTC: {},
  count: {},
  countBy: {},
}

for (var key in fields) {
  var field = fields[key]
  field = _.extend(defaultField, field)
  field.key = key
  field.name = field.name || key
  field.patchholder = field.patchholder || key
}


var LeftCol = React.createClass({
  render: function() {
    var rows = Object.keys(fields).map(function(key) {
      return <div className="row" key={'left_' + key}>{key}</div>
    })
    return <div className="col-left.pad">{rows}</div>
  }
})

var QueryForm = React.createClass({
  render: function() {
    return (
      <div className="container">
      <LeftCol />
      </div>
    )
  }
})


module.exports = QueryForm
