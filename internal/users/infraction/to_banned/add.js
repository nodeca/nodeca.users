// Move user to banned
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* add_user_to_violators(params) {
    let banned = yield N.models.users.UserGroup.findOne()
                          .where('short_name').equals('banned')
                          .lean(true);

    yield N.models.users.User.update({ _id: params.infraction.for }, { usergroups: [ banned._id ] });

    yield N.models.users.UserPenalty.update(
      { user: params.infraction.for },
      { $unset: { expire: '' } }
    );
  });
};
