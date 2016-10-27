
'use strict';

const _           = require('lodash');
const identicon   = require('nodeca.users/lib/identicon');
const avatarWidth = '$$ JSON.stringify(N.config.users.avatars.resize.orig.width) $$';


N.wire.once('navigate.done:' + module.apiPath, function init_handlers() {

  // Submit button handler
  //
  N.wire.on(module.apiPath + ':submit', function update_user(form) {
    let data = _.assign({ user_hid: form.$this.data('user-hid') }, form.fields);

    return N.io.rpc('admin.users.members.edit.update', data).then(() =>
      N.wire.emit('notify', {
        type: 'info',
        message: t('saved')
      })
    );
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


  // Show account deletion confirmation dialog
  //
  N.wire.before(module.apiPath + ':delete_account', function confirm_delete_account() {
    return N.wire.emit('admin.core.blocks.confirm', t('delete_account_confirm'));
  });


  // Click on delete account button
  //
  N.wire.on(module.apiPath + ':delete_account', function delete_account(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.delete_account', { user_hid, 'delete': true })
               .then(() => N.wire.emit('navigate.reload'));
  });


  // Show restore account confirmation dialog
  //
  N.wire.before(module.apiPath + ':restore_account', function confirm_restore_account() {
    return N.wire.emit('admin.core.blocks.confirm', t('restore_account_confirm'));
  });


  // Click on restore account button
  //
  N.wire.on(module.apiPath + ':restore_account', function restore_account(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.delete_account', { user_hid, 'delete': false })
               .then(() => N.wire.emit('navigate.reload'));
  });


  // Show delete dialogs confirmation dialog
  //
  N.wire.before(module.apiPath + ':delete_dialogs', function confirm_delete_dialogs() {
    return N.wire.emit('admin.core.blocks.confirm', t('delete_dialogs_confirm'));
  });


  // Click on delete dialogs button
  //
  N.wire.on(module.apiPath + ':delete_dialogs', function delete_dialogs(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.delete_dialogs', { user_hid }).then(() =>
      N.wire.emit('notify', {
        type: 'info',
        message: t('dialogs_deleted')
      })
    );
  });


  // Show unblock confirmation dialog
  //
  N.wire.before(module.apiPath + ':unblock', function confirm_unblock() {
    return N.wire.emit('admin.core.blocks.confirm', t('unblock_confirm'));
  });


  // Click on unblock button
  //
  N.wire.on(module.apiPath + ':unblock', function unblock(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.unblock', { user_hid })
               .then(() => N.wire.emit('navigate.reload'));
  });


  // Show delete votes confirmation dialog
  //
  N.wire.before(module.apiPath + ':delete_votes', function confirm_delete_votes() {
    return N.wire.emit('admin.core.blocks.confirm', t('delete_votes_confirm'));
  });


  // Click on delete votes button
  //
  N.wire.on(module.apiPath + ':delete_votes', function delete_votes(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('admin.users.members.edit.delete_votes', { user_hid }).then(() =>
      N.wire.emit('notify', {
        type: 'info',
        message: t('votes_deleted')
      })
    );
  });
});
