// Show page with group edit form

'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    _id: { format: 'mongo', required: true }
  });


  N.wire.on(apiPath, function* usergroup_edit(env) {
    let res = env.res;

    // Fill Default settings and their configuration
    res.setting_schemas = N.config.setting_schemas.usergroup || {};

    // We always fetch all groups, to calculate inheritances on client
    let groups = yield N.models.users.UserGroup.find().sort('_id');

    let currentGroup = _.find(groups, g => String(g._id) === env.params._id);

    if (!currentGroup) throw N.io.NOT_FOUND;

    res.head.title = env.t('title', { name: currentGroup.short_name });

    res.current_group_id = currentGroup._id.toString();
    res.groups_data      = _.invokeMap(groups, 'toJSON');
  });
};
