// Load frequently used user data (user_info)
//
// - user_id
// - user_hid
// - usergroups
// - hb
// - user_name
// - user_avatar
// - is_guest
// - is_member
// - locale
//
'use strict';


var memoizee = require('memoizee');


// Find and cache usergroup ObjectId forever. Use only for 'protected' groups.
//
var findUsergroupId = memoizee(function (shortName, N, callback) {
  N.models.users.UserGroup.findIdByName(shortName, callback);
}, { async: true, length: 1 });


// Get user info for a guest
//
function load_guest_user_info(N, callback) {
  findUsergroupId('guests', N, function (err, guestsId) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, {
      user_id: '000000000000000000000000',
      user_hid: 0,
      usergroups: [ guestsId ],
      hb: false,
      user_name: '',
      user_avatar: null,
      is_guest: true,
      is_member: false,
      // Will be overwritten by session value in request
      locale: null
    });
  });
}


module.exports = function load_user_info(N, id, callback) {

  if (!id || String(id) === '000000000000000000000000') {
    load_guest_user_info(N, callback);
    return;
  }

  N.models.users.User.findById(id)
      .select('_id hid name usergroups locale hb avatar_id')
      .lean(true)
      .exec(function (err, user) {

    if (err) {
      callback(err);
      return;
    }

    if (!user) {
      load_guest_user_info(N, callback);
      return;
    }

    callback(null, {
      user_id: String(user._id),
      user_hid: user.hid,
      usergroups: user.usergroups,
      hb: user.hb,
      user_name: user.name,
      user_avatar: user.avatar_id,
      is_guest: false,
      is_member: true,
      locale: user.locale
    });
  });
};
