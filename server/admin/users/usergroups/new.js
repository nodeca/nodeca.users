'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.setting_schemas = N.config.setting_schemas['usergroup'] || {};

    N.models.users.UserGroup
        .find()
        .select('_id short_name is_protected parent_group raw_settings')
        .sort('is_protected _id')
        .setOptions({ lean: true })
        .exec(function (err, groupsData) {
      data.groups_data = groupsData;
      callback(err);
    });
  });
};
