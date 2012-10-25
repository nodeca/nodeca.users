'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;
var async = require('nlib').Vendor.Async;


////////////////////////////////////////////////////////////////////////////////


// Helper to fetch usergroups by IDs
//
function fetchUserGroups(ids, callback) {
  nodeca.models.users.UserGroup.find().where('_id').in(ids).exec(callback);
}


// Memoized version of fetchUserGroups helper
//
var fetchUserGroupsCached = nodeca.components.memoizee(fetchUserGroups, {
  // momoizee options. revalidate cache after 30 sec
  async:  true,
  maxAge: 30000
});


////////////////////////////////////////////////////////////////////////////////


var UserGroupStore = new Store({
  get: function (key, params, options, callback) {
    var func = options.skipCache ? fetchUserGroups : fetchUserGroupsCached;

    func(params.usergroup_ids, function (err, grps) {
      if (err) {
        callback(err);
        return;
      }

      var values = grps.map(function (grp) {
        var value = grp.settings && grp.settings[key];

        // map to the list of settings key value
        return undefined === value ? null : value;
      }).filter(function (value) {
        // leave only those who have ones
        return !!value;
      });

      // push default value
      values.push({ value: UserGroupStore.getDefaultValue(key) });

      callback(null, Store.mergeValues(values));
    });
  },
  set: function (values, params, callback) {
    fetchUserGroups(params.usergroup_ids, function (err, groups) {
      if (err) {
        callback(err);
        return;
      }

      // leave only those params, that we know about
      values = _.pick(values || {}, UserGroupStore.keys);

      // set values for each usergroup
      async.forEach(groups, function (group, next) {
        if (!group.settings) {
          group.settings = {};
        }

        _.each(values, function (opts, key) {
          group.settings[key] = { value: opts.value, force: !!opts.value };
        });

        group.markModified('settings');
        group.save(next);
      }, callback);
    });
  },
  params: {
    usergroup_ids: {
      type: 'array',
      required: true,
      minItems: 1
    }
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = UserGroupStore;
