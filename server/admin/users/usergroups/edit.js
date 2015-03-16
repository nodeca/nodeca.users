// Show page with group edit form

'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    _id: { format: 'mongo', required: true }
  });


  N.wire.on(apiPath, function usergroup_edit(env, callback) {
    var res = env.res;

    // Fill Default settings and their configuration
    res.setting_schemas = N.config.setting_schemas.usergroup || {};

    // We always fetch all groups, to calculate inreritances on client
    N.models.users.UserGroup
        .find()
        .select('-settings')
        .sort('_id')
        .exec(function (err, groups) {

      if (err) {
        callback(err);
        return;
      }

      var currentGroup = _.find(groups, function (g) {
        return String(g._id) === env.params._id;
      });

      if (!currentGroup) {
        callback(N.io.NOT_FOUND);
        return;
      }

      res.head.title =
        env.t('title', {
          name: currentGroup.short_name
        });

      res.current_group_id = currentGroup._id.toString();
      res.groups_data      = _.invoke(groups, 'toJSON');
      callback();
    });
  });
};
