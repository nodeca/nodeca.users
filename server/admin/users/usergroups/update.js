'use strict';


module.exports = function (N, apiPath) {
  var UserGroup = N.models.users.UserGroup;


  N.validate(apiPath, {
    _id: {
      type: 'string'
    , required: true
    , minLength: 24
    , maxLength: 24
    }
  , short_name: {
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


  // test_circular_step(groups, checked, sample) -> Boolean
  // - groups (Object): Hash of groups, { _id => parent }
  // - checked (String): checked group id
  // - sample (Stirng): target group id
  //
  // Recursive test parents
  function test_circular_step(groups, checked, sample) {
    if (!groups[checked]) {
      return false;
    }
    if (groups[checked] === sample) {
      return true;
    }
    return test_circular_step(groups, groups[checked], sample);
  }


  // test_circular(id, parent_group, callback)
  // - id (Object): group id
  // - parent_group (Object): parent id
  // - callback(function) : callback with err and is_circular params
  //
  // Check parents for circular inheritance.
  // Fire callback with search result as second parameter
  // true if has circular and false if not
  //
  function test_circular(id, parent_group, callback) {
    if (!parent_group) {
      callback(null, false);
      return;
    }

    UserGroup.find().select('_id parent_group').exec(function (err, docs) {
      var groups = {};
      if (err) {
        callback(err);
      }
      // collect groups to hash
      // { _id => parent_group }
      docs.forEach(function (group) {
        groups[group._id.toString()] = group.parent_group ? group.parent_group.toString() : null;
      });

      callback(null, test_circular_step(groups, parent_group.toString(), id.toString()));
    });
  }


  N.wire.on(apiPath, function (env, callback) {
    UserGroup.findById(env.params._id).exec(function (err, group) {
      if (err) {
        callback(err);
        return;
      }

      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      group.raw_settings.usergroup = env.params.raw_settings.usergroup;
      group.markModified('raw_settings.usergroup');

      test_circular(group._id, group.parent_group, function (err, isCircular) {
        if (err) {
          callback(err);
          return;
        }

        if (isCircular) {
          callback({
            code: N.io.BAD_REQUEST,
            message: env.helpers.t('admin.users.usergroups.update.error.circular_dependency')
          });
          return;
        }

        group.save(function (err) {
          if (err) {
            callback(err);
            return;
          }

          N.settings.set('usergroup', env.params.settings.usergroup, { usergroup_id: group._id }, callback);
        });
      });
    });
  });
};
