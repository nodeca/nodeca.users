'use strict';


/*global nodeca, _*/


// 3rd-party
var Store = require('nlib').Settings.Store;


var fetch_usergroups = nodeca.components.memoizee(function (ids, callback) {
  nodeca.models.UserGroup.find().where('_id').in(ids).exec(callback);
}, { async: true, maxAge: 30000 });


////////////////////////////////////////////////////////////////////////////////


var UsergroupStore = new Store({
  get: function (key, params, options, callback) {
    fetch_usergroups(params.usergroup_ids, function (err, ugs) {
      if (err) {
        callback(err);
        return;
      }

      var values = ugs.map(function (ug) { return ug.settings[key]; });

      values.push( UsergroupStore.getDefaultValue(key) );

      callback(null, Store.mergeValues(values));
    });
  },
  set: function (values, params, callback) {
    callback('Not implemented yet');
  },
  params: {
    usergroup_ids: { type: 'array', required: true }
  }
});


////////////////////////////////////////////////////////////////////////////////


module.exports = UsergroupStore;
