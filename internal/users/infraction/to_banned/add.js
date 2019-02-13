// Move user to banned
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function add_user_to_violators(params) {
    let banned_group_id = await N.models.users.UserGroup.findIdByName('banned');

    await N.models.users.User.updateOne({ _id: params.infraction.for }, { usergroups: [ banned_group_id ] });

    // Remove previous penalty if exists
    await N.models.users.UserPenalty.deleteOne({ user: params.infraction.for });
  });
};
