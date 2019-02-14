// Remove user from violators when expired
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function remove_user_from_violators(penalty) {
    // Fetch usergroup _id
    let violators_group_id = await N.models.users.UserGroup.findIdByName('violators');


    // Fetch users
    let user = await N.models.users.User.findOne()
                          .where('_id').equals(penalty.user)
                          .select('_id usergroups')
                          .lean(true);
    if (!user) return;


    // Remove violators usergroup
    //
    let usergroups = user.usergroups.filter(gid => String(gid) !== String(violators_group_id));

    // If user have no more groups (should never happens) - add default group
    if (!usergroups.length) {
      let registered_group = await N.settings.get('registered_user_group');

      usergroups = [ registered_group ];
    }

    await N.models.users.User.updateOne(
      { _id: user._id },
      { usergroups }
    );
  });
};
