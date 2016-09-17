Proposed migration steps for each user

Synthesize user.tag (see tag spec below).
Set user.role to "admin"
Create a new root patch: { name:[user.name], tag:[see tag spec], type:"patch" }. User is owner/modifier/creator. Tag must be globally unique and is used when a user logs into a patch user account. Users will be able to edit the patch.name and tag to whatever they want as long as the tag is globally unique. We might want to use the tag as part of the entity._id like we did with beacons.
Set user._patch to patch.tag from previous step.
Build a list of all patches where user is the owner.
Copy the patches, set type="channel", and link to the root patch.
Build a union list of all users who are members of any patch in the list.
Create guest user accounts for each user in the list and set guestuser._patch=patch.tag, guestuser.role = "guest"
For each guest account copy over the property values from the source user.
Copy all the existing membership links from the source users to the guest users where the target patch is owned by the user we are currently processing. These will be used to restrict the guest account to specific channels.
Admin can easily convert a guest account to a normal account.


Tags

We use tags as friendly identifiers for patches and users that can be used in the UI, messaging, etc.
Patch tags are globally scoped.
User tags are patch scoped.
Patch tags must lowercase and only include letters, numbers, and hyphens. (only characters that would be valid in a subdomain)
User tags must lowercase and only include letters, numbers, and periods.
For data migration we need to synthesize tags that would have normally be set by a user. Start with the entity name and lowercase it. Trim trailing or leading spaces and reduce spans of multiple spaces to a single space. Next replace all spaces with hyphens or periods depending on whether it is a user or patch. If unique within the target scope then we are finish. If not, then add a number as a suffix and increment until the tag is unique.


Here is our current rough idea of how this will happen:

Write a migration script that copies and transforms data from the V1 database to the V2 database. (See issue #441)
Write communication to existing users about the changes in Patchr 2.0. Warn them that once Patchr 2.0 is available, version 1.0 will be turned off and they will be required to update to 2.0 to continue using the Patchr service.
Release Patchr 2.0 clients.
Force client updates using minimum client version from the V1 service.
Migrate data from V1 to V2.
Supporting a more gradual transition from V1 to V2 would require a single user migration script that would be executed on first-run of a V2 client.
