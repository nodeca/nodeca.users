// Register avatar helper
//
// We generate identicons and display avatars in the client-side code,
// so this helper just returns an empty gif + necessary data attributes.
//

'use strict';

// Returns a list of attributes for avatar img tag.
//
// Usage:
//  - avatar_helper(user [, size_name])
//  - avatar_helper(user_id [, size_name])
//  - avatar_helper(user_id, user [, size_name])
//
function avatar_helper(user_id, user, size_name) {
  var avatar_id;

  if (typeof(user_id) !== 'string') {
    // avatar_helper(user [, size_name])
    size_name = user;
    user = user_id;
    user_id = user._id;
  }

  if (typeof(user) !== 'object') {
    // avatar_helper(user_id [, size_name])
    size_name = user;
    user = null;
  }

  if (user) {
    avatar_id = user.avatar_id;
  }

  return {
    // transparent 1x1 gif
    'src': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'class': '_identicon',
    'data-user-id': user_id,
    'data-avatar-id': avatar_id,
    'data-avatar-size': size_name
  };
}

module.exports = function () {
  require('nodeca.core/lib/system/env').helpers.avatar = avatar_helper;
};
