// Show existing groups list

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function* usergroups_list(env) {
    let res = env.res;

    res.head.title = env.t('title');
    res.usergroups = [];

    res.usergroups = yield N.models.users.UserGroup
                              .find()
                              .select('_id short_name is_protected')
                              .sort('_id')
                              .lean(true);
  });


  N.wire.after(apiPath, function* usergroups_list_join_members_count(env) {
    let res = env.res;

    res.members_count = {};

    yield res.usergroups.map(
      group => N.models.users.User
                  .count({ usergroups: group._id })
                  .then(members_count => {
                    res.members_count[group._id] = members_count;
                  }));
  });
};
