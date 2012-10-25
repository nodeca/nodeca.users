'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;
var async = require('nlib').Vendor.Async;


////////////////////////////////////////////////////////////////////////////////


// Helper to fetch usergroups by IDs
//
function fetchUsrGrpSettings(ids, callback) {
  nodeca.models.users.UserGroup.find()
    .select('settings')
    .where('_id').in(ids)
    .exec(callback);
}


// Memoized version of fetchUserGroups helper
//
var fetchUsrGrpSettingsCached = nodeca.components.memoizee(fetchUsrGrpSettings, {
  // momoizee options. revalidate cache after 30 sec
  async:  true,
  maxAge: 30000
});


////////////////////////////////////////////////////////////////////////////////


var UserGroupStore = new Store({
  get: function (key, params, options, callback) {
    var func = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

    func(params.usergroup_ids, function (err, grps) {
      if (err) {
        callback(err);
        return;
      }

      var values = [];

      grps.forEach(function (grp) {
        if (grp.settings && grp.settings[key]) {
          values.push(grp.settings[key]);
        }
      });

      // push default value
      values.push({ value: UserGroupStore.getDefaultValue(key) });

      var result;

      try {
        result = Store.mergeValues(values);
      } catch (err) {
        callback(err);
        return;
      }

      callback(null, result);
    });
  },
  set: function (values, params, callback) {
    fetchUsrGrpSettings(params.usergroup_ids, function (err, grps) {
      if (err) {
        callback(err);
        return;
      }

      // leave only those params, that we know about
      values = _.pick(values || {}, UserGroupStore.keys);

      // set values for each usergroup
      async.forEach(grps, function (grp, next) {
        grp.settings = grp.settings || {};

        _.each(values, function (opts, key) {
          grp.settings[key] = {
            value: opts.value,
            force: !!opts.value
          };
        });

        grp.markModified('settings');
        grp.save(next);
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
