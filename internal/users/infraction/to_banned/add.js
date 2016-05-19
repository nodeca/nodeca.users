// Move user to banned
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* add_user_to_violators(params) {
    let banned_group_id = yield N.models.users.UserGroup.findIdByName('banned');

    yield N.models.users.User.update({ _id: params.infraction.for }, { usergroups: [ banned_group_id ] });

    // Remove previous penalty if exists
    yield N.models.users.UserPenalty.remove({ user: params.infraction.for });
  });
};
