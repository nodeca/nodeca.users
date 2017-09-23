// Show form to create new group

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, async function usergroup_create_form(env) {
    let res = env.res;

    res.head.title = env.t('title');

    // Fill Default settings and their configuration
    res.setting_schemas = N.config.setting_schemas.usergroup || {};

    // Fetch real values from groups
    // We always fetch all groups, to calculate inreritances on client
    res.groups_data = await N.models.users.UserGroup.find()
                                                    .sort('_id')
                                                    .lean(true);
  });
};
