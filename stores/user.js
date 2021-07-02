'use strict';


module.exports = function (N) {

  // ##### Params
  //
  // - user_id (String|ObjectId)
  //
  return N.settings.createStore({
    get(keys, params) {
      if (!params.user_id) {
        return Promise.reject('user_id param required to getting settings from user store');
      }

      return N.models.users.UserSettings.findOne({ user: params.user_id }).lean(true).then(data => {
        let results = {};

        keys.forEach(key => {
          if (data?.[key]) {
            results[key] = data[key];
          } else {
            results[key] = {
              value: this.getDefaultValue(key),
              force: false // Default value SHOULD NOT be forced.
            };
          }
        });

        return results;
      });
    },

    // ##### Params
    //
    // - user_id (String|ObjectId)
    //
    set(settings, params) {
      if (!params.user_id) {
        return Promise.reject('user_id param is required for saving settings into user store');
      }

      return N.models.users.UserSettings.findOne({ user: params.user_id }).then(data => {
        if (!data) {
          data = new N.models.users.UserSettings({ user: params.user_id });
        }

        for (let [ key, option ] of Object.entries(settings)) {
          data.set(key, option);
        }

        return data.save();
      });
    }
  });
};
