// Remove user from violators when expired
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* remove_user_from_violators(penalty) {
    // Fetch usergroup
    let violators_group = yield N.models.users.UserGroup.findOne()
                                    .where('short_name').equals('violators')
                                    .lean(true);


    // Fetch users
    let user = yield N.models.users.User.findOne()
                          .where('_id').equals(penalty.user)
                          .select('_id usergroups')
                          .lean(true);
    if (!user) return;


    // Remove violators usergroup
    //
    let usergroups = user.usergroups.filter(gid => String(gid) !== String(violators_group._id));

    // If user have no more groups (should never happens) - add default group
    if (!usergroups.length) {
      let registered_group = yield N.settings.get('registered_user_group');

      usergroups = [ registered_group ];
    }

    yield N.models.users.User.update(
      { _id: user._id },
      { usergroups }
    );
  });
};
