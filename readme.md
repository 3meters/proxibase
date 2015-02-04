# Proxibase
Proxibase is the backing service for 3meters patchr and related services

## Url

    https://api.aircandi.com/v1

## Quick Reference

Sign in

    path: /auth/signin
    method: POST|GET
    body|query: {
      user: {
        email: <email>,
        password: <password>,
        install: <installId>,  // client device Id, can be any string
      }
    }

Send an authenticated request

    body|query: {
      user: <user._id>,
      session: <session.key>,
      install: <installId>,    // client device Id, can be any string
    }

## Find Documents

Collection or field names can be expressed with native mongodb
object syntax or with comma-delimited strings.

    nameExpr:  {name1: 1, name2: -1, name3: true, name4: false}
                - or - 
                'name1,-name2,name3,-name4'

Many APIs pass through mongodb query expressions:

    queryExpr: <passThroughMongoDbQueryExpr>
    
Find:

    path: /find/<collection>/<_id>
    method: GET|POST
    body|query: {
      name: string,                             // case-insensitive starts-with
      fields: nameExpr
      query: queryExpr,                         // pass-through to mongodb
      refs: boolean || comma-separated string,  // display data from _linked documents, refs=name
      limit: number,                            // default 50, max 1000
      skip: number,
      sort: nameExpr,
      count: boolean,                           // returns no records, only count, limit and skip are ignored
      countBy:  string                          // returns count of collection grouped by field or fields
      links: {
        from: nameExpr                          // returns links from this document
        to: nameExpr                            // returns links to this document
        sort: nameExpr,                         // applies to link fields, not document fields
        skip: number,                           // links skip
        limit: number,                          // links limit
        filter: queryExpr,                      // link filter
        fields: nameExpr,                       // link fields
        docFields: nameExpr,                    // linked document fields, if false don't fetch linked document
        docFilter: queryExpr,                   // linked document filter
        count: boolean,                         // return count of qualifying links, ignores skip and limit
      }   // the links param also accepts an array of link specs
    }

results are returned as so:

      [
        {
          _id: <doc1Id>
          field1: 'foo',
          field2: 'bar',
          ...
          linked: [
            linkedDoc1,
            linkedDoc2,
            ...
          ]
        },{
          _id: <doc2Id>
          field1: 'foofoo',
          field2: 'barbar',
          ...
          linked: [
            linkedDoc1,
            linkedDoc2,
            ...
          ]
        }
      ]

Under each linkedDoc is a link property containing the link itself.  The sort, skip, limit, and filter properties apply to the link, not the linked document, to support paging.


## Users and Admins
Each user account has a role.  The only valid roles are 'user', the default, and 'admin'.  When the server starts it checks for a user with _id 00000.000000.00000.000.00000.  If it does not exist the server creates the user with 

    {
      _id: '00000.000000.00000.000.00000',
      email: 'admin',
      name: 'admin',
      namelc: 'admin',
      role: 'admin',
      password: 'admin'
    }

Users or tests can log in with these credentials to perform administrative tasks.

With a few exeptions, admins can perform any operation on the server that would be prevented by permissions.

### Creating New Users
See the guidelines for posting below, the api is 

    path: /user/create
    body|query:  {
      data: {
        name: <name>,
        email: <email>,
        password: <password>,
      },
      secret: <secret>,
      installId: <installId>,
    }

All other fields are optional. Secret is currently a static string. Someday it may be provided by a captcha API.  On successful account creation, the service signs in the user, creating a new session object.  The complete user and session object are returned to the caller.

Note that on success this call sets return status code to 200, not 201 and one might expect.  This is due to chaining the call to signin.  

## Authentication
Users can be authenticated locally with a password.  We do not yet support oauth authentication. 

### Local Auth
Users sign in via :

    path: /auth/signin
    body|query: {
      email: <email>,
      password: <password>,
      installId: <installId>,
    }

On success the api returns a credentials object with three fields: user, session and install. In order to validate subsequent requests, include those values on each request, either as query parameters like so:

    /data/users?user=0000.120628.57119.055.350009&session=fb3f74034f591e3053e6e8617c46f&instal=<instalId>

or as fields in the body of a post like so:

    /find/users
    method: post
    body: {
      "query": {"namelc": "jay massena"},
      "user": '0000.120628.57119.055.350009",
      "session": 'fb3f74034f591e3053e6e8617c46fb35",
      "install": "installId"
    }

If you pass invaild session credentials the request will fail with a 401 (not authorized).  If they are valid, all responses will contain a user object that includes the user's id and name.

Sessions can be destroyed via

    path: /auth/signout
    method: get

    with user and session passed in as query parameters

### Passwords

User passwords cannot be updated via the ordinary rest methods, only via the change password api:

    path: /user/changepw
    body|query: {
      user:{
        _id:  user._id
        oldPassword: oldPassword
        newPassword: newPassword
      }
    }

### Oauth

Oauth is NYI
   
## Rest
The system provides find, insert, update, and remove methods over the base mongodb collections via standard REST apis.  

### GET /schema/\<collection\>
Returns the collection's schema

### _id fields
Every document in every collection has a unique, immutable _id field of the form:

    clid.yymmdd.scnds.mil.random

meaning

    collectionId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /data/\<collection\>
Returns the collection's first 50 records unsorted.

### GET /data/\<collection\>/\<id\>
Returns the document with the specified id

### GET /data/\<collection\>?name=<name>
Returns documents with a name beginning with the specified name, case-insensitive.

### GET /data/\<collection\>/genId
Generates a valid id for the collection with the UTC timestamp of the request.  Useful if you want to make posts to mulitple tables with the primary and foreign keys preassigned.

    ?sort=namelc,-age
Returns sorted by name case ascending, age decending

    ?limit=30
Returns only the first 30 records. Default 50. Max 1000. If there are more records available the more=true flag will be set in the response.  

    ?skip=1000
Skip the first 1000 records. Use in conjection with sort, limit, and more to provide paging.

    ?count=ture
Only return the count of the collection, not any of the data.  Limit, skip, and field paramters are ignored.

    ?countBy=fieldName
Returns the count of the colleciton grouped by fieldName

    ?datesToUTC=true
Converts dates stored in miliseconds since 1970 to UTC-formated strings

    ?refs='name'|true|fieldExpr
For any fields in the document of the form _<key> which equals the _id field of another collection, add a field to the result named <key> which includes the value of the named field from the referenced collection. Set true to include the referenced document as a nested object under <key>.  refs='name' is the most common setting.  For all documents with a _owner field, it will ad a field called owner that is equal to name of the owning user.

### POST Rules:
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Write the data for the new object inside a data element in the request body:

    request.body = {
      "data": {
        "field1": "foo",
        "field2": "bar"
      }
    }

### POST /data/\<collection\>
Inserts req.body.data into the collection.  If a value for _id is specified it will be used, otherwise the server will generate a value for _id.  Only one record may be inserted per request. If you specifiy values for any of the system fields, those values will be stored.  If you do not the system will generate defaults for you.  The return value is the newly created document. 

### POST /data/\<collection\>/\<id\>
Updates the document with _id = id in collection.  The return value updated document. Note that complex fields (objects) will be completely replaced by the updated values, even if you only specify one of their sub-fields in your update.

### DELETE /data/\<collection\>/\<id1\>
Deletes the document

<a name="webmethods"></a>
## Custom Web Methods
    
    /do
    
Lists the custom web methods. 

<a name="statistics"></a>
### Statistics
Site statistics are acceessed via

    GET /stats

This will return a list of supported stats.

    GET /stats/
    
Refreshing statitics requires admin credentials since the operation can be expensive

### Recurring Tasks
The service supports a built-in recurring task scheduler based on the later module, https://github.com/bunkat/later.  It enables admins to insert, update, or remove scheduled tasks via the rest api.  

When the server starts, it reads all task documents and starts later tasks based on those documents.  Tasks can be inserted, updated, or removed dynamically.  Tasks execute trusted server methods.

## Wiki
* (proxibase/wiki/)

## Bugs and Feature Ideas
https://github.com/3meters/proxibase/issues?state=open

## Developer Notes
To build and run

    cd /config
    cp config.js.template config.js  # modify as needed but should work unmodified
    cd ..
    npm install
    node prox

## Tests
By default tests require internet connectivity and a working sendmail server

Run basic tests

    cd test
    node test

More test options

    cd test
    node test --help
