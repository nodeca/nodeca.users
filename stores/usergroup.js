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
    .select('is_forced settings.usergroup')
    .where('_id').in(ids)
    .setOptions({ lean: true })
    .exec(callback);
}


// Memoized version of fetchUserGroups helper
//
var fetchUsrGrpSettingsCached = nodeca.components.memoizee(fetchUsrGrpSettings, {
  // memoizee options. revalidate cache after 30 sec
  async:      true,
  maxAge:     60000,
  primitive:  true
});


////////////////////////////////////////////////////////////////////////////////


// ##### Params
//
// - usergroup_ids (Array)
//
module.exports = new Store({
  get: function (keys, params, options, callback) {
    var self = this;
    var func = options.skipCache ? fetchUsrGrpSettings : fetchUsrGrpSettingsCached;

    if (!_.isArray(params.usergroup_ids) || !params.usergroup_ids.length) {
      callback("usergroup_ids param required to be non-empty array for getting settings from usergroup store");
      return;
    }

    func(params.usergroup_ids.sort(), function (err, grps) {
      var results = {};

      if (err) {
        callback(err);
        return;
      }

      keys.forEach(function (k) {
        var values = [];

        grps.forEach(function (grp) {
          var settings = (grp.settings || {}).usergroup;

          if (settings && settings[k]) {
            values.push({
              value: settings[k].value,
              force: !!grp.is_forced
            });
          } else {
            values.push({
              value: self.getDefaultValue(k),
              // default value SHOULD NOT be forced
              force: false
            });
          }
        });

        // get merged value
        results[k] = Store.mergeValues(values);
      });

      callback(null, results);
    });
  },
  // ##### Params
  //
  // - usergroup_id (String|ObjectId)
  //
  set: function (settings, params, callback) {
    var self = this;

    if (!params.usergroup_id) {
      callback("usergroup_id param is required for saving settings into usergroup store");
      return;
    }

    nodeca.models.users.UserGroup.findOne({
      _id: params.usergroup_id
    }).exec(function (err, grp) {
      if (err) {
        callback(err);
        return;
      }

      // make sure we have settings storages
      grp.settings = grp.settings || {};
      grp.settings.usergroup = grp.settings.usergroup || {};

      _.each(settings, function (opts, key) {
        if (null === opts) {
          delete grp.settings.usergroup[key];
        } else {
          grp.settings.usergroup[key] = {
            value: opts.value,
            // UserGroup store does not use force flag - it's dynamically
            // calculated on UserGroup#is_forced property of model.
            //
            // RESERVED for possible future use
            force: false
          };
        }
      });

      grp.markModified('settings.usergroup');
      grp.save(callback);
    });
  }
});
