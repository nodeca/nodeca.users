// Add user to violators
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* add_user_to_violators(params) {
    let violators_group = yield N.models.users.UserGroup.findOne()
                                    .where('short_name').equals('violators')
                                    .lean(true);

    yield N.models.users.User.update(
      { _id: params.infraction.for },
      { $addToSet: { usergroups: violators_group._id } }
    );

    let expire = new Date(Date.now() + (params.action_data.days * 24 * 60 * 60 * 1000));

    yield N.models.users.UserPenalty.update(
      { user: params.infraction.for },
      { expire, type: 'to_violators' },
      { upsert: true }
    );
  });
};
