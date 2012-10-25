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
    .setOptions({ lean: true })
    .exec(callback);
}


// Memoized version of fetchUserGroups helper
//
var fetchUsrGrpSettingsCached = nodeca.components.memoizee(fetchUsrGrpSettings, {
  // memoizee options. revalidate cache after 30 sec
  async:  true,
  maxAge: 30000
});


////////////////////////////////////////////////////////////////////////////////


module.exports = new Store({
  get: function (keys, params, options, callback) {
    var self = this;
    var func = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

    func(params.usergroup_ids, function (err, grps) {
      if (err) {
        callback(err);
        return;
      }

      var results = {};

      keys.forEach(function (k) {
        var values = [], defaultValue = { value: self.getDefaultValue(k) };

        grps.forEach(function (grp) {
          if (grp.settings && grp.settings[k]) {
            values.push(Store.mergeValues([ grp.settings[k], defaultValue ]));
          }
        });

        // get merged value
        results[k] = Store.mergeValues(values);
      });

      callback(null, results);
    });
  },
  set: function (values, params, callback) {
    var self = this;

    fetchUsrGrpSettings(params.usergroup_ids, function (err, grps) {
      if (err) {
        callback(err);
        return;
      }

      // leave only those params, that we know about
      values = _.pick(values || {}, self.keys);

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
  }
});
