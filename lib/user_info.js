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
// - is_member
// - active
// - locale
//
'use strict';


// Get user info for a guest
//
function load_guest_user_info(N) {
  return N.models.users.UserGroup.findIdByName('guests')
    .then(guestsId => ({
      user_id: '000000000000000000000000',
      user_hid: 0,
      usergroups: [ guestsId ],
      hb: false,
      user_name: '',
      user_avatar: null,
      is_member: false,
      active: false,
      // Will be overwritten by session value in request
      locale: null
    }));
}


async function load_user_info(N, ids) {

  if (!ids || String(ids) === '000000000000000000000000') {
    return await load_guest_user_info(N);
  }

  var fields = [
    '_id',
    'hid',
    'name',
    'usergroups',
    'locale',
    'hb',
    'active',
    'avatar_id'
  ];

  // Multiple users

  if (Array.isArray(ids)) {
    let users = await N.models.users.User
                          .find()
                          .where('_id').in(ids)
                          .select(fields.join(' '))
                          .lean(true);

    let result = users.reduce((acc, user) => {
      acc[String(user._id)] = {
        user_id: String(user._id),
        user_hid: user.hid,
        usergroups: user.usergroups,
        hb: user.hb,
        user_name: user.name,
        user_avatar: user.avatar_id,
        is_member: true,
        active: user.active,
        locale: user.locale
      };

      return acc;
    }, {});

    if (users.length < ids.length) {
      let guest_info = await load_guest_user_info(N);

      ids.forEach(id => { if (!result[id]) result[id] = guest_info; });
    }

    return result;
  }

  // Single user

  let user = await N.models.users.User
                      .findOne()
                      .where('_id').equals(ids)
                      .select(fields.join(' '))
                      .lean(true);

  if (!user) {
    return await load_guest_user_info(N);
  }

  return {
    user_id: String(user._id),
    user_hid: user.hid,
    usergroups: user.usergroups,
    hb: user.hb,
    user_name: user.name,
    user_avatar: user.avatar_id,
    is_member: true,
    active: user.active,
    locale: user.locale
  };
}


module.exports = load_user_info;
