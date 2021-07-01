// Register avatar helper, and display avatars on page load/page update
//

'use strict';


const identicon   = require('nodeca.users/lib/identicon');


let avatarSizes = {};

for (let [ key, val ] of Object.entries('$$ JSON.stringify(N.config.users.avatars.resize) $$')) {
  avatarSizes[key] = val.width;
}


// Returns a list of attributes for avatar img tag.
//
// Usage:
//  - avatar_helper(user [, size_name])
//  - avatar_helper(user_id [, size_name])
//  - avatar_helper(user_id, user [, size_name])
//
function avatar_helper(user_id, user, size_name) {
  let avatar_id, src;

  if (typeof user_id !== 'string') {
    // avatar_helper(user, size_name)
    size_name = user;
    user = user_id;
    user_id = user._id;
  }

  if (typeof user !== 'object') {
    // avatar_helper(user_id, size_name)
    size_name = user;
    user = null;
  }

  if (user) {
    avatar_id = user.avatar_id;
  } else if (N?.runtime && N.runtime.user_id === user_id) {
    avatar_id = N.runtime.user_avatar;
  }

  if (size_name && !avatarSizes[size_name]) {
    throw new Error('Invalid avatar size: ' + size_name);
  }

  if (avatar_id) {
    src = N.router.linkTo('core.gridfs', { bucket: avatar_id + (size_name ? '_' + size_name : '') });
  } else {
    src = identicon(user_id, avatarSizes[size_name ? size_name : 'orig']);
  }

  return { src };
}


// Replace placeholders (images with "_identicon" class) with avatars
//
function replace_placeholders(selector, users) {
  selector.find('._identicon').each(function (n, img) {
    let $img = $(img),
        user_id = $img.data('user-id'),
        avatar_id = $img.data('avatar-id'),
        size_name = $img.data('avatar-size');

    if (size_name && !avatarSizes.hasOwnProperty(size_name)) {
      throw new Error('invalid avatar size: ' + size_name);
    }

    // If current user is missing avatar info - try to restore
    if (user_id === N.runtime.user_id && N.runtime.user_avatar) {
      avatar_id = avatar_id || N.runtime.user_avatar;
    }

    // Avatar id is not specified, but we can retrieve it from locals
    if (users?.[user_id]) {
      avatar_id = avatar_id || users[user_id].avatar_id;
    }

    $img.removeClass('_identicon');
    if (avatar_id) {
      $img.attr('src', N.router.linkTo('core.gridfs', { bucket: avatar_id + (size_name ? '_' + size_name : '') }));
    } else {
      $img.attr('src', identicon(user_id, avatarSizes[size_name ? size_name : 'orig']));
    }
  });
}


N.wire.once('init:assets', function avatar_helper_register() {
  N.runtime.render.helpers.avatar = avatar_helper;
});


// Replace identicons after initial page load
//
N.wire.once('navigate.done', function identicon_replace(data) {
  if (!data.first_load) return; // already handled by content_update

  // page generated on server-side with users provided through page_data
  replace_placeholders($(document), N.runtime.page_data.users);
});


// Replace identicons when any new content is loaded (prefetch or navigation between pages)
//
N.wire.on('navigate.content_update', function identicon_replace(data) {
  replace_placeholders(data.$, data.locals.users);
});
