// Update usergroup settings
//
"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {

  // Defaults params (static)
  var params_schema = {
    _id: {
      type: 'string',
      required: true,
      minLength: 24,
      maxLength: 24
    },
    parent: {
      type: 'string',
      minLength: 24,
      maxLength: 24
    }
  };

  var usergroup_schema = N.config.setting_schemas['usergroup'];

  // generate settings validators (get info from config)
  _.keys(usergroup_schema).forEach(function (name) {
    var item_type = usergroup_schema[name]['type'];
    if (!_.any(['string', 'number', 'boolean'],
        function (t) { return t === item_type; })) {
      item_type = 'string';
    }
    params_schema[name] = { type: item_type };
  });

  N.validate(params_schema);


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

  // test_circular(id, parent, callback)
  // - id (Object): group id
  // - parent (Object): parent id
  // - callback(function) : callback with err and is_circular params
  //
  // Check parents for circular inheritance.
  // Fire callback with search result as second parameter
  // true if has circular and false if not
  //
  function test_circular(id, parent, callback) {
    if (!parent) {
      callback(null, false);
      return;
    }
    N.models.users.UserGroup.find().select('_id parent').exec(function (err, docs) {
      var groups = {};
      if (err) {
        callback(err);
      }
      // collect groups to hash
      // { _id => parent }
      docs.forEach(function (group) {
        groups[group._id.toString()] = group.parent ? group.parent.toString() : null;
      });

      callback(null, test_circular_step(groups, parent.toString(), id.toString()));
    });
  }


  // Request handler. Here we update group parameters
  // (inheritance, overrides and other)
  // !Don't mix with `settings`!
  //
  N.wire.on(apiPath, function (env, callback) {
    var items = _.clone(env.params);

    // remove _id parent from property list
    delete items['_id'];
    delete items['parent'];

    N.models.users.UserGroup.findById(env.params._id).exec(function (err, group) {
      if (err) {
        callback(err);
        return;
      }

      // group not found
      if (!group) {
        callback(N.io.NOT_FOUND);
        return;
      }

      // update parent
      if (!_.isUndefined(env.params.parent)) {
        group.parent = env.params.parent;
      }

      // update group items one by one
      _.keys(items).forEach(function (name) {
        if (_.isNull(items[name])) {
          items[name] = usergroup_schema[name]['default'];
        }

        // FIXME eval before_save
        group.raw_settings[name] = items[name];
      });

      // this command required for update Mixed fields
      // see Mixed in http://mongoosejs.com/docs/schematypes.html
      group.markModified('raw_settings');

      test_circular(group._id, group.parent, function (err, is_circular) {
        if (err) {
          callback(err);
          return;
        }

        if (is_circular) {
          callback({
            code: N.io.BAD_REQUEST,
            data: {
              common: env.helpers.t('admin.users.usergroups.edit.error.circular_dependency')
            }
          });
          return;
        }

        group.save(callback);
      });
    });
  });

  // After group update - regenerate settings
  //
  N.wire.after(apiPath, function _update_store(env, callback) {
    var values = {};

    // prepare values for the store
    _.each(env.params, function (val, key) {
      values[key] = { value: val };
    });

    N.settings.set('usergroup', values, { usergroup_id: env.params._id }, callback);
  });
};