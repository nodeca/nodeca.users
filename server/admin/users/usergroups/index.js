// Show existing groups list

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, async function usergroups_list(env) {
    let res = env.res;

    res.head.title = env.t('title');
    res.usergroups = [];

    res.usergroups = await N.models.users.UserGroup
                              .find()
                              .select('_id short_name is_protected')
                              .sort('_id')
                              .lean(true);
  });


  N.wire.after(apiPath, async function usergroups_list_join_members_count(env) {
    let res = env.res;

    res.members_count = {};

    await Promise.all(res.usergroups.map(
      group => N.models.users.User
                  .count({ usergroups: group._id })
                  .then(members_count => {
                    res.members_count[group._id] = members_count;
                  })
    ));
  });
};
