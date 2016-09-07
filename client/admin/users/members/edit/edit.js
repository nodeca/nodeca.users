
'use strict';

const _           = require('lodash');
const identicon   = require('nodeca.users/lib/identicon');
const avatarWidth = '$$ JSON.stringify(N.config.users.avatars.resize.orig.width) $$';


N.wire.once('navigate.done:' + module.apiPath, function init_handlers() {

  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function update_user(form) {
    let data = _.assign({ user_hid: form.$this.data('user-hid') }, form.fields);

    return N.io.rpc('admin.users.members.edit.update', data).then(function () {
      N.wire.emit('notify', {
        type: 'info',
        message: t('saved')
      });
    });
  });


  // Show delete avatar confirmation dialog
  //
  N.wire.before(module.apiPath + ':delete_avatar', function confirm_delete_avatar() {
    return N.wire.emit('admin.core.blocks.confirm', t('delete_avatar_confirm'));
  });


  // Click on delete avatar button
  //
  N.wire.on(module.apiPath + ':delete_avatar', function delete_avatar(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.delete_avatar', { user_hid }).then(() => {
      let $root = data.$this.parent('.user-edit-avatar');
      let $img = $root.find('.user-edit-avatar__image');

      $img.attr('src', identicon(N.runtime.user_id, avatarWidth));
      $root.removeClass('user-edit-avatar__m-exists');
    });
  });
});
