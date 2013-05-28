// Show form to create new group

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.head.title = env.t('title');

    // Fill Default settings and their configuration
    data.setting_schemas = N.config.setting_schemas['usergroup'] || {};

    // Fetch real values from groups
    // We always fetch all groups, to calculate inreritances on client
    N.models.users.UserGroup
        .find()
        .select('-settings')
        .sort('_id')
        .setOptions({ lean: true })
        .exec(function (err, groupsData) {
      data.groups_data = groupsData;
      callback(err);
    });
  });
};
