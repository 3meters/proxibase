# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: [https://www.proxibase.com](https://www.proxibase.com)

API: [https://service.proxibase.com](https://service.proxibase.com)

### GET /_info
Returns table information for the rest API

### Get /_do
Returns a list of custom web methods

## REST API

### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse.  The proxiabse server generates these on each record insert, or the client may supply one on insert. _id fields have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.randm

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /tableName/_info
Returns information about the table's schema.

### GET /tableName
Returns the table's first 1000 records unsorted.

### GET /tableName/:id1,id2
Returns records with the specified _ids. Note the initial colon.

### GET parameters
GET query parameters are ordinary: The paramter chain begins with a ? and is delimited by &.  Unrecognized paramters are ignored.

    ?__jsonfind={"firstname":"John","lastname":{"$in":["Smith","Jones"]},"age":{"$lt":5}}
Returns all records in the table using mongodbs advanced [query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries).  The value of the parameter must be in JSON format. The rest of the url need not be JSON.

    ?__fields=_id,name,created
Returns only the fields specified. Default is to return all fields. _id is always returned. 

    ?__limit=30
Returns only the first 30 records.  Default and max is 1000.

    ?__lookups=true 
Returns each document with its lookup fields fully populated. Ignored if __fields is set. Default is false;


### POST rules
1. Set req.headers.content-type to 'application-json'
2. Make sure req.body is parsable json
3. Enclose new data in a data element, e.g: 

    req.body = {
      "data": {
        "field1": "foo",
        "field2": "bar" 
      }
    }

### POST /tablename
Inserts req.body.data into the tablename table.  If you supply a value for _id it will be used.  If you not, one will be generated for you. Currently only one record can be inserted at a time.

### POST /tablename/:id1
Updates the record with _id = <id1> in tablename.  Fields not inlucded in req.body.data will not be modified.

### DELETE /tablename/:id1,id2
Deletes those records.

### DELETE /tablename/:*
Deletes all records in the table.

## Custom Web Methods

### GET /_do
Lists web methods.

### POST /_do
Executes a method specified the request body. The body must be in JSON format and have these elements:  
    {
      "name": "methodName",
      "params": {}
    } 

If methodName exists the system will call methodName(params);

## Etc
* [Building a Proxibase Server from scratch](wiki/ServerSetup)
