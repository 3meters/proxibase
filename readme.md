# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: [https://www.proxibase.com](https://www.proxibase.com)

API: [https://service.proxibase.com](https://service.proxibase.com)


## REST API
[https://service.proxibase.com/_info](https://service.proxibase.com/_info)

Returns schema information

### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse. _ids have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.random

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
Returns the records in the table found using mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries). The value of __jsonfind must be parsable JSON. The rest of the url need not.

    ?__fields=_id,name,created
Returns only the fields specified. _id is always returned. 

    ?__limit=30
Returns only the first 30 records. Max 1000.

    ?__lookups=true 
Returns each document with its lookup fields fully populated. Ignored if __fields is set. Default false.


### POST Rules
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Enclose new data in a data element, e.g: 

    req.body = {
      "data": {
        "field1": "foo",
        "field2": "bar" 
      }
    }

### POST /tablename
Inserts req.body.data into the tablename table.  If a value for _id is specified it will be used, otherwise the server will generate a value for _id.  Only one record may be inserted per request.

### POST /tablename/:id1
Updates the record with _id = id1 in tablename.  Fields not inlucded in req.body.data will not be modified.

### DELETE /tablename/:id1,id2
Deletes those records.

### DELETE /tablename/:*
Deletes all records in the table.

## Custom Web Methods
[https://service.proxibase.com/_do](https://service.proxibase.com/_do)

Lists the web methods.

### POST /_do
Executes a method specified in the request body. The body must be in JSON format and have these elements:  

    {
      "name": "methodName",
      "params": {}
    } 

The system will call methodName(params).

## Etc
* [Building a Proxibase Server from scratch](proxibase/wiki/ServerSetup)
