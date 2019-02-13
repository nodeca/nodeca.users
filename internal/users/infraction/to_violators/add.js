// Add user to violators
//
'use strict';


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function add_user_to_violators(params) {
    let violators_group_id = await N.models.users.UserGroup.findIdByName('violators');

    await N.models.users.User.updateOne(
      { _id: params.infraction.for },
      { $addToSet: { usergroups: violators_group_id } }
    );

    let expire = new Date(Date.now() + (params.action_data.days * 24 * 60 * 60 * 1000));

    await N.models.users.UserPenalty.updateOne(
      { user: params.infraction.for },
      { expire, type: 'to_violators' },
      { upsert: true }
    );
  });
};
