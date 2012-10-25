"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;

var usergroup_schema = nodeca.config.setting_schemas['usergroup'];

// Validate input parameters
//
var params_schema = {
  _id: {
    type: 'string',
    required: true
  },
  parent: {
    type: 'string',
  }
};

_.keys(usergroup_schema).forEach(function (name) {
  var item_type = usergroup_schema[name]['type'];
  if (!_.any(['string', 'number', 'boolean'],
      function (t) { return t === item_type; })) {
    item_type = 'string';
  }
  params_schema[name] = { type: item_type };
});

nodeca.validate(params_schema);


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
  UserGroup.find().select('_id parent').exec(function (err, docs) {
    var groups = {};
    if (err) {
      callback(err);
    }
    // collect groups fo hash
    // { _id => parent }
    docs.forEach(function (group) {
      groups[group._id.toString()] = group.parent ? group.parent.toString() : null;
    });

    callback(null, test_circular_step(groups, parent.toString(), id.toString()));
  });
}


/**
 * admin.usergroups.update(params, callback) -> Void
 *
 *
 * Update usergroup property
 **/
module.exports = function (params, next) {
  var env   = this;
  var items = _.clone(params);

  // remove _id parent from property list
  delete items['_id'];
  delete items['parent'];

  UserGroup.findById(params._id).exec(function (err, group) {
    if (err) {
      next(err);
      return;
    }

    // group not found
    if (!group) {
      next(nodeca.io.NOT_FOUND);
      return;
    }

    // update parent
    if (!_.isUndefined(params.parent)) {
      group.parent = params.parent;
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
        next(err);
        return;
      }

      if (is_circular) {
        next({
          code: nodeca.io.BAD_REQUEST,
          data: {
            common: env.helpers.t('admin.users.usergroups.edit.error.circular_dependency')
          }
        });
        return;
      }

      group.save(next);
    });
  });
};


nodeca.filters.after('@', function update_usergroup_store(params, next) {
  var store   = nodeca.settings.getStore('usergroup');
  var values  = _.pick(params, store.keys);

  // prepare values for the store
  _.each(values, function (val, key) {
    values[key] = { value: val, force: false };
  });

  store.set(values, { usergroup_ids: [ params._id ] }, next);
});
