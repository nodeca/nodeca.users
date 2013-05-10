// Show page with group edit form

'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    _id: {
      type: 'string'
    , required: true
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    // Fill Default settings and their configuration
    data.setting_schemas = N.config.setting_schemas['usergroup'] || {};

    // We always fetch all groups, to calculate inreritances on client
    N.models.users.UserGroup
        .find()
        .select('-settings')
        .sort('is_protected _id')
        .exec(function (err, groups) {

      if (err) {
        callback(err);
        return;
      }

      var currentGroup = _.find(groups, { id: env.params._id });

      if (!currentGroup) {
        callback(N.io.NOT_FOUND);
        return;
      }

      data.head.title =
        env.helpers.t('admin.users.usergroups.edit.title', {
          name: currentGroup.short_name
        });

      data.current_group_id = currentGroup._id.toString();
      data.groups_data      = _.invoke(groups, 'toJSON');
      callback();
    });
  });
};
