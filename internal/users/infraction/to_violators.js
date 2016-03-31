// Add user to violators and remove when expired
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  // Add user to violators
  //
  N.wire.on(apiPath, function* add_user_to_violators(params) {
    let violators = yield N.models.users.UserGroup.findOne()
                              .where('short_name').equals('violators')
                              .lean(true);

    yield N.models.users.User.update({ _id: params.infraction.for }, { $addToSet: { usergroups: violators._id } });

    let expire = new Date(Date.now() + (params.action_data.days * 24 * 60 * 60 * 1000));

    yield N.models.users.UserPenalty.update(
      { user_id: params.infraction.for },
      { expire },
      { upsert: true }
    );
  });


  // Remove violators if penalty expired
  //
  N.wire.on('internal:users.infraction.invalidate_penalties', function* invalidate_penalties() {
    let now = new Date();


    // Fetch expired
    let expired_penalties = yield N.models.users.UserPenalty.find()
                                      .where('expire').lte(now)
                                      .lean(true);
    let user_ids = _.map(expired_penalties, 'user_id');


    // Fetch usergroup
    let violators_group = yield N.models.users.UserGroup.findOne()
                                    .where('short_name').equals('violators')
                                    .lean(true);


    // Fetch users
    let users = yield N.models.users.User.find()
                          .where('_id').in(user_ids)
                          .select('_id usergroups')
                          .lean(true);


    // Remove violators usergroup
    //
    for (let i = 0; i < user_ids.length; i++) {
      let user = users.find(u => String(u._id) === String(user_ids[i]));

      if (!user) continue;

      // Remove violators from array
      let usergroups = user.usergroups.filter(gid => String(gid) !== String(violators_group._id));

      if (!usergroups.length) {
        let registered_group = yield N.settings.get('registered_user_group');

        // If user have no more groups (should never happens) - add default group
        usergroups = [ registered_group ];
      }

      yield N.models.users.User.update(
        { _id: user._id },
        { usergroups }
      );
    }


    // Remove penalty info
    //
    yield N.models.users.UserPenalty.remove(
      { user_id: { $in: user_ids } }
    );
  });
};
