'use strict';


var _ = require('lodash');
var fetchGroups = require('./_lib/fetch_groups');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function (env, callback) {
    var data = env.response.data;

    data.setting_schemas = N.config.setting_schemas['usergroup'] || {};

    fetchGroups(N, _.keys(data.setting_schemas), function (err, allGroupsData) {
      data.groups_data = allGroupsData;
      callback(err);
    });
  });
};
