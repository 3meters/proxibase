# Private and Hidden Places Tech Spec

## User Model
Places (aka patches) can have three scopes of visibility: public, private, or hidden.  Public is what we have now and is the default.  Private means that a patch (or some subset of its fields) is generally visible in all lists that display places, but that that all content entities linked to that patch are invisible, unless the owner of a patch has specifically granted access to that user.  Secret (hidden?) places are not visible any any of the standard public lists, particlaryly nearby.  Nor may content posted to that place be seen by non-invited users.

This spec discusses various technical options for implemeting private and secret places.

## Tools
  * systemCollection  (_base.js, set on action, install, session, task)
  * ownerAccess (implemented in _base, set on user, document, session)
  * before read trigger:  Perform preselects, edit the query before it is executed
  * after read trigger: Handle the results after they have been read from the db, but before they are returned to the caller.
  * Custom field lists (Ipmlented in user as a read trigger but not generallized:  some fields availabe publically (name, picture), others are ownerAccess.
  * Master-detail query engines:  We have two!  safeFind links and getEntitiesForEntity.
  * Triggers on reads and writes of links
  * fields:  currently all entities have a _place field which is set by convention by the client, and could be use to quickly check permissions.

## Current Link Permissions
In link.js we have couple of rules coded now.  1) You cannot create a link from an entity that you do not own.  Once a user creates a link, we set its owner to the owner of the _to entity for links of type content, or to the owner of the _from entity for non-conent links.  Only the owner can remove (this is currently enfoced before any of the code in link.js has had a chance to run -- exceptions would go into _base.js)


## Proposed Link Permission Changes:
1) When links are created, we will always set the link owner to the owner of the _to entity, regardless of link type.

2) Owners of the _from entity can remove a link, but they cannot otherwise edit it.


## Invitations:
Currently when Tarzan invites Jane to watch his treehouse, we create one message entity with the invitation, then two links of type 'share'.  The first is from the message to the Treehouse; the second is from the message to Jane, and possibly others.   In the client, if Jane follows the share link to the message ('accept' in the client ui), the client creates a watch link from Jane to the treehouse.


## Scenarios:
Requesting to join a private place:
Tarzan notices that Janes manssion is nearby, but is private.  His UI says "request to watch" or something like that.  The client creates a watch link from Tarzan to treehouse.   A service side link trigger notices that the mansion is private, and enforces that the link property enabled is set to false.  Jane is notified that Tazan wants to watch her mansion.  The link is owned by Jane, since she owns the mansion.

Declining a request to join a private place:
Jane deletes the link.  Tarzan should *not* be notified of this.

Accept a request to join a private place:
Jane sets the enabled bit of the link. Tarzan is notified

Kicking a user out of a private or secret place:
Jane removes the watch link from tarzan to mansion.  Tarzan should not be notified.

Leaving a private or secret place.
Tarzan should be able to delete the watch link, before or after Jane acts on it, even though he does not own it.

Inviting a user to join a private or secret place:
Tarzan creates a message entity inviting Jane to watch his secret Treehouse.  He also creates two links of type 'share', one from the message to Jane, and one from the message to the treehouse.  This works the same for all types of places, public, private, and secret.

Declining an invitation to join a private or secret place:
In the client UI Jane declines Tarzans invitation.  The client simply deletes the share link From Treehouse to Jane.  This is allowed automatically because Jane, as the ower of the _to entity (her own user record) owns the link.

Accepting an invitation to join a pivate or secret place:
If Jane accepts Tarzans invitation the client will create a watch link from Jane to Treehouse.  Normally this would be set to disabled, since the Treehouse is secret.  However, the service will query for an outstanding share link between the treehouse and messages, and between any of those messages and Jane.  (Two hops, yuck)  If it finds Jane among the invited list it will enable Janes watch link automatically in one step.


Jay: We need to make sure the invitation came from someone with authority to approve a watch request. We are using the share linking essentially as pre-approval right?

Jay: A future feature is a patch owner can let patch members add new members. Facebook groups has this.

Jay: Who can share an invite to a private place or secret place? My thoughts:
- If you can see it you can share it.
- If share comes from patch owner, share links are pre-approval for a watch request.
- If share comes from non-owner, share links are not pre-approval. User still needs to go through watch request/approval workflow.


Quit watching a private or secret place
Jane needs to be able to delete her Treehouse watch link, even though Tarzan owns it.


## Visibility of private places
Private places are visible in all the ordinary queries, including near and suggest.


## Visbility of secret places
Secret places are invisible to near and suggest queries. This is enforced by a read trigger on places that adds a new filter : {visibility: {$ne: 'secret'}}.

For singleton safeFinds access is granted by passing in a new option to the safeFind query:  'watchId'.  WatchId is the _id of the watch link between the user and the secret place.  This token must be passed in by the client as part of the call to getEntitiesForEntity.  A read trigger on places looks up the watchId from the links table and confirms that it exists, has the correct fields, and is owned by the owner of the place.  If all these conditions are met the non-secret filter is removed and the place is returned.

### Issue: Secret place visibly to members?
Should secret places appear in the nearby or search results of people who have access to them?

Jay: If possible, I think members should see secret places in lists. We might want to follow the facebook visibility rules where possible: https://www.facebook.com/help/220336891328465.

## Visbility of child entities of private and secret places
Messages will become an ownerAccess collection. We will introduce a new option to safeFind, asReader.  This functions like asAdmin, but is more restrictive.  First, it only affects reads, not writes, and second, it does not change the scope of the private fields on the users table.  getEntitiesForEntity and getEntities.   For entities of schema place, it will first look up the entity and check if 1) it is public, 2) the user has a watch link to the entity itself, or 3) if the user has a watch link to the _place field of the target entity.  If any of these is true, 

getEntitiesforEntity will in turn call getEntities with asReader permissions to override the ownerAccess flag.

## Issue: safeFind links
Arguably safeFind should respect the asReader option for sublinked documents.  We're going to put this off for now since the android client doesn't use the feature.

## Issue: Watch vs. Join
Currently we are using watch to signify membership in private and hidden places, and to trigger increased notifications.  This is probably right in general, but you can conceive of wanting to maintain your membership in a secret place but cut down on the notification chatter.  We will ignore this for now and stick with watch.

## Issue:  Rejection notifications
We need be careful about the notifcations, since there are some events that we might need to broadcast in order for the client UI to update, but we do not want to send messages about rejections.  I am not very familiar with the nuances of this code.

