// Load frequently used user data (user_info)
//
// - N
// - ids - user _id, could be array
// - callback - `function (err, result)`
//
// result (hash `_id -> fields` if ids is array):
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


const thenify = require('thenify');


// Get user info for a guest
//
function load_guest_user_info(N, callback) {
  N.models.users.UserGroup.findIdByName('guests', function (err, guestsId) {
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


function load_user_info(N, ids, callback) {

  if (!ids || String(ids) === '000000000000000000000000') {
    load_guest_user_info(N, callback);
    return;
  }

  var fields = [
    '_id',
    'hid',
    'name',
    'usergroups',
    'locale hb',
    'avatar_id'
  ];

  if (Array.isArray(ids)) {
    N.models.users.User.find()
        .where('_id').in(ids)
        .select(fields.join(' '))
        .lean(true)
        .exec(function (err, users) {

      if (err) {
        callback(err);
        return;
      }

      var result = users.reduce(function (acc, user) {
        acc[String(user._id)] = {
          user_id: String(user._id),
          user_hid: user.hid,
          usergroups: user.usergroups,
          hb: user.hb,
          user_name: user.name,
          user_avatar: user.avatar_id,
          is_guest: false,
          is_member: true,
          locale: user.locale
        };

        return acc;
      }, {});

      if (users.length < ids.length) {
        load_guest_user_info(N, function (err, guest_info) {
          if (err) {
            callback(err);
            return;
          }

          ids.forEach(function (id) {
            if (!result[id]) {
              result[id] = guest_info;
            }
          });

          callback(null, result);
        });

        return;
      }

      callback(null, result);
    });

    return;
  }

  N.models.users.User.findOne()
      .where('_id').equals(ids)
      .select(fields.join(' '))
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
}


module.exports = thenify(load_user_info);
