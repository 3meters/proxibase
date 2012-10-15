# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: https://www.aircandi.com

API: https://aircandi.com:643

## Quick Reference

POST: /auth/signin

    body: {
      user: {
        email: (case-insensitive)
        password: password  (case-sensitive)
      }
    }

authenticated user query params:

    user=\<user._id\>&session=\<session.key\>

POST /do/find:

    {
      "collection|stat": string,          // base collection or statitistics collection
      "ids": [string],
      "names": [string],                  // case-insensitive
      "fields": [string],
      "find": {mongodb find expression},  // pass-through to mongodb, case-sensitive
      "lookups": boolean,                 // temporarily disabled
      "limit": number,                    // default and max is 1000
      "skip": number, 
      "sort": {field1:1, field2:-1},
      "count": boolean,                   // returns no records, only count, limit and skip are ignored
      "countBy": fieldName                // returns count of collection grouped by any field
    }
    

## Users and Admins
Each user account has a role.  The only valid roles are 'user', the default, and 'admin'.  When the server starts it checks for a user with _id 00000.000000.00000.000.00000.  If it does not exist the server creates the user with 

    {
      _id: '00000.000000.00000.000.00000',
      email: 'admin',
      name: 'admin',
      role: 'admin',
      password: 'admin'
    }
    
Users or tests can log in with these credentials to perform administrative tasks.

With a few exeptions, admins can perform any operation on the server that would be prevented by permissions.  Users, in general, can read everything, write records to most tables, and can update records that they own.  Users cannot update or delete records owned by other users.

### Creating New Users
See the guidelines for posting below, the api is 

    path: /user/create
    method: post
    secret: <secret>
    body:  {data: {
      email: <email>
      password: <password>
    }}

all other fields are optional. Secret is currently a static string. Someday it may be provided by a captcha API.  On successful account creation, the service signs in the user, creating a new session object.  The complete user and session object are returned to the caller.

Note that on success this call sets return status code to 200, not 201 and one might expect.  This is due to doubleing us the signin call.  

## Authentication
Users can be authenticated locally with a password or via a oauth provider such as Facebook, Twitter, or Google.  Their authentication source is stored in the users.authSource field which is required.  Valid values may be found in util.statics.authSources.  User emails must be unique.

### Local
If a new user is created with a password we assume the authSource is local.  We validate that the password is sufficiently strong before saving, and we save a one-way hash of the password the user entered.  See the users schema for the password rules and hash methods.

Users sign in via :

    path: /auth/signin
    method: post
    body: {
      user: {
        email: (case-insensitive)
        password: password  (case-sensitive)
      }
    }

On success the api returns a session object with two fields of interest, _owner and key.  _owner is user's _id, and key is a session key.  In order to validate a request, include those values on each request, either as query parameters like so:

    /data/users?user=0000.120628.57119.055.350009&session=fb3f74034f591e3053e6e8617c46fb35
    method:  get, post, or delete

or as fields in the body of a post like so:

    /do/find
    method: post
    body: = {
      table:'users',
      user: 0000.120628.57119.055.350009
      session: fb3f74034f591e3053e6e8617c46fb35
    }

If you pass invaild session credentials the request will fail with a 401 (not authorized).  If they are valid, all responses will contain a user object that includes the user's id and name. Sessions are bound to a particular client IP address.  They expire after two weeks without use.

Sessions can be destroyed via

    path: /auth/signout
    method: get

    with user and session passed in as query parameters

### Passwords

User passwords cannot be updated via the ordinary rest methods, only via the change password api:

    path: /user/changepw  
    method: post
    body: {
      user:{
        _id:  user._id
        oldPassword: oldPassword
        newPassword: newPassword
      }
    }

### Oauth

Signin via ouath like so:

    path: /auth/signin/facebook|twitter|google
    method: get

Session management after a sucessful authentication is the same as with local authentication.  If the user authenticates via an oauth provider, we store their provider credentials and user key, allowing us to access their picture and other provider specific data (friends, followers, etc) on their behalf.  

## Rest
The system provides find, insert, update, and remove methods over the base mongodb collections via standard REST apis.  

### GET /schema
Returns the base collections

### GET /schema/\<collection\>
Returns the collection's schema

### _id fields
Every document in every collection has a unique, immutable _id field of the form:

    clid.yymmdd.scnds.mil.random

meaning

    collectionId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /data/\<collection\>
Returns the collection's first 1000 records unsorted.

### GET /data/\<collection\>/\<id1\>,\<id2\>
Returns records with the specified ids

### GET /data/\<collection\>?names:\<name1,name2\>
Returns records with the specified names, case-insensitive.  If the names include spaces, use POST /do/find 

### GET /data/tablename/genid
Generates a valid id for the table with the UTC timestamp of the request.  Useful if you want to make posts to mulitple tables with the primary and foreign keys preassigned.

    ?sort={"namelc":1, "age:-1"}
Returns sorted by name lower case ascending, age decending

    ?limit=30
Returns only the first 30 records. Max 1000.

    ?skip=1000
Skip the first 1000 records. Use in conjection with sort and limit to provide paging.

    ?count=ture
Only return the count of the collection, not any of the data.  Limit, skip, and field paramters are ignored.

    ?lookups=true
TEMPORARILY DISABLED

Returns each document with its lookup fields fully populated. Default false.


### POST Rules
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Write the data for the new object inside a data element in the request body.  The new element can either be a simple object or an array of objects.
4. You may put your updated elements inside an array, however currently only one element is supported per post

ie

    request.body = {
      "data": {
        "field1": "foo",
        "field2": "bar"
      }
    }

or

    request.body = {
      "data": [
        {
          "field1": "foo",
          "field2": "bar"
        }
      ]
    }

### POST /data/\<collection\>
Inserts req.body.data or req.body.data[0] into the collection.  If a value for _id is specified it will be used, otherwise the server will generate a value for _id.  Only one record may be inserted per request. If you specifiy values for any of the system fields, those values will be stored.  If you do not the system will generate defaults for you.  The return value is all fields of the newly created record inside a data tag. 

### POST /data/\<collection\>/\<id\>
Updates the document with _id = id in collection.  Non-system fields not inlucded in request.body.data or request.body.data[0] will not be modified. The return value is all fields of the modified document inside a data tag.  

### DELETE /data/\<collection\>/\<id1,id2\>
Deletes those records

### DELETE /data/\<collection\>/*
Deletes all records in the collection (admins only)

<a name="webmethods"></a>
## Custom Web Methods
    /do
Lists the web methods. POST to /do/methodName executes a method passing in the full request and response objects. The request body must be in JSON format. 

### POST /do/echo
Returns request.body

### POST /do/find
POST /do/find is the same as GET /data/<collection>, but with the paramters in the request body rather than on the query string, useful for complex queries. Request body should be JSON of this form:

    {
      "collection|stat": string,          // base collection or statitistics collection
      "ids": [string],
      "names": [string],                  // case-insensitive
      "fields": [string],
      "find": {mongodb find expression},  // pass-through to mongodb, case-sensitive
      "lookups": boolean,                 // temporarily disabled
      "limit": number,                    // default and max is 1000
      "skip": number, 
      "sort": {field1:1, field2:-1},
      "count": boolean,                   // returns no records, only count, limit and skip are ignored
      "countBy": fieldName                // returns count of collection grouped by any field
    }
    
The collection|stat property is required.  All others are optional.

### POST /do/touch
Updates every record in a table.  Usefull when you need to re-run triggers on all records

    {
      "collection": <collection>,     // required
      "preserveModified, boolean      // optional, default true, if false the method will update the modified date
    }

<a name="stats">
### Statistics
Site statistics are acceessed via 

    GET /stats

This will return a list of supported stats.  For each stat

    GET /stats/<stat>
  
will return a collection of the statistics.  These are ordinary monogodb collections.  In the database their names are prefixed by "stats_".  All the normal parameters to the rest GET API will work.  POST /do/find works too using the body param stat: <stat>. All statistic collections are static, and must be recomputed to be current. To recompute a statistic, add the parameter 

    ?refresh=true

Refreshing statitics requires admin credentials since the operation can be expensive


## Wiki
* (proxibase/wiki/)

## Todo

### Bugs

### Models
* Add schema checker to base.js
* Broken links: prevent or garbage collect
* Create user captcha

### Custom Methods
* Respect locked Entity on InsertEntity, UpdateEntity, DeleteEntity, InsertComment

### Tests
* Insert comments on others records

### Authentication
* Validate user email workflow
* Recover lost password workflow
* Create user with oauth workflow
* Oauth tests for Facebook and Google

### Rate limiting
* Map users to accounts
* Accrue user requests to acconts
* Rate limit gets
* Rate limit posts
* Lock / unlock account

### Website
* Read-only browse UI over tables
* User profile update UI
* My Candi UI

### Rest
* get: lookups
* get: field lists for lookups
* get: children
* get: fields lists for children
* get: outer joins
* get: child counts
* get: table.childtable.childtable...
* get: singleton get
* post: insert array
* saveAPI: convert to mongoskin

### Misc
* scrub old style errors from custom methods
* rationalize version migration into a command-linable pipeline
* do version migration in place?

