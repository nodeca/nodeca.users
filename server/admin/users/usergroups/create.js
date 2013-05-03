'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, {
    short_name: {
      type: 'string'
    , required: true
    , minLength: 1
    }
  , parent_group: {
      type: ['string', 'null']
    , required: true
    , minLength: 24
    , maxLength: 24
    }
  , raw_settings: {
      type: 'object'
    , required: true
    , properties: {
        usergroup: {
          type: 'object'
        , required: false
        , 'default': {}
        }
      }
    }
  , settings: {
      type: 'object'
    , required: true
    , properties: {
        usergroup: {
          type: 'object'
        , required: true
        }
      }
    }
  });


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.count({ short_name: env.params.short_name }).exec(function (err, existent) {
      if (err) {
        callback(err);
        return;
      }

      if (existent) {
        callback({
          code: N.io.BAD_REQUEST
        , message: env.helpers.t('admin.users.usergroups.create.error.short_name_busy')
        });
        return;
      }

      var group = new UserGroup(_.pick(env.params, [
        'short_name'
      , 'parent_group'
      , 'raw_settings'
      ]));

      group.save(function (err) {
        if (err) {
          callback(err);
          return;
        }

        N.settings.set('usergroup', env.params.settings.usergroup, { usergroup_id: group._id }, callback);
      });
    });
  });
};
