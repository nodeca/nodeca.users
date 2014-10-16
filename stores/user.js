'use strict';


var _ = require('lodash');


module.exports = function (N) {

  // ##### Params
  //
  // - user_id (String|ObjectId)
  //
  var UserStore = N.settings.createStore({
    get: function (keys, params, options, callback) {
      var self = this;

      if (_.isEmpty(params.user_id)) {
        callback('user_id param required to getting settings from user store');
        return;
      }

      N.models.users.UserSettings
        .findOne({ user_id: params.user_id })
        .lean(true)
        .exec(function (err, data) {
          var results = {};

          if (err) {
            callback(err);
            return;
          }

          keys.forEach(function (key) {
            if (data && data[key]) {
              results[key] = data[key];
            } else {
              results[key] = {
                value: self.getDefaultValue(key),
                force: false // Default value SHOULD NOT be forced.
              };
            }
          });

          callback(null, results);
        });
    },

    // ##### Params
    //
    // - user_id (String|ObjectId)
    //
    set: function (settings, params, callback) {
      if (!params.user_id) {
        callback('user_id param is required for saving settings into user store');
        return;
      }

      N.models.users.UserSettings
        .findOne({ user_id: params.user_id })
        .exec(function (err, data) {

          if (err) {
            callback(err);
            return;
          }

          if (!data) {
            data = new N.models.users.UserSettings({ user_id: params.user_id });
          }

          _.forEach(settings, function (option, key) {
            data.set(key, option);
          });

          data.save(callback);
        });
    }
  });

  return UserStore;
};
