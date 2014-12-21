/** @jsx React.DOM */

// Query component generated from a map


var React = require('react')


// Default field properties
var defaultField = {
  key:   '',
  name:  '',
  type:  'string',
  help:  '',
  input: null,  // or component
  placeholder: '',
}


// Query form fields
var fields = {
  collection: {},
  _id: {},
  fields: {
    help: 'name,address,city'},
  name: {},
  query: {
    help: '{city: {$in: ["Seattle", "Squim"]}}',
  },
  sort: {
    help: 'city,-_id'
  },
  refs: {
    help: 'true || name || name,modifiedDate'},
  links: {
    help: '{to: {patches: 1}, linkFilter: {type: "content"}}',
  },
  skip: {},
  limit: {},
  datesToUTC: {},
  count: {},
  countBy: {
    help: 'city,postalCode'
  },
}


// Flesh out field defaults
for (var i in fields) {
  var field = fields[i]
  for (var j in defaultField) {
    if (tipe.isUndefined(field[j])) {
      field[j] = defaultField[j]
    }
  }
  field.key = i
  field.name = field.name || i
  field.placeholder = field.placeholder || i
}


var LeftCol = React.createClass({
  render: function() {
    var rows = Object.keys(fields).map(function(key) {
      return <div className="row" key={key}>{key}</div>
    })
    return <div className="col-left pad">{rows}</div>
  }
})


var CenterCol = React.createClass({
  render: function() {

    var selectCollection = this.props.clNames.map(function(clName) {
      return(<option value={clName}>{clName}</option>)
    })

    var rows = Object.keys(fields).map(function(key) {
      var field = fields[key]
      if (key === 'collection') {
        return (
          <div className="row" key={key}>
            <select className="field" id={key} name={field.name}>
              {selectCollection}
            </select>
          </div>
        )
      }
      else {
        return (
          <div className="row" key={key}>
            <input className="field" id={key} name={field.name} placeholder={field.placeholder} />
          </div>
        )
      }
    })

    return (
      <div className="col-center pad">
        <form id="explore" method="post" action="/v1/explore">
          {rows}
          <input type="submit" name="cmdRun" value="Go" />
        </form>
      </div>
    )
  }
})


var RightCol = React.createClass({
  render: function() {
    var rows = Object.keys(fields).map(function(key) {
      var help = fields[key].help
      help = help || ''
      return <div className="row" key={key}>{help}</div>
    })
    return <div className="col-right pad">{rows}</div>
  }
})


var QueryForm = React.createClass({
  render: function() {
    return (
      <div className="container">
        <LeftCol />
        <CenterCol clNames={this.props.clNames} />
        <RightCol />
      </div>
    )
  }
})


module.exports = QueryForm
