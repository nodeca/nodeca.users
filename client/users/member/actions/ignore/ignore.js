'use strict';


N.wire.once('navigate.done:users.member', function page_once() {

  // Show a dialog adding a user to ignore list
  //
  N.wire.on('users.member:add_ignore', function add_ignore(data) {
    return N.wire.emit('users.blocks.ignore_user_dlg', data)
      .then(() => N.wire.emit('notify', { type: 'info', message: t('ignore_added') }))
      .then(() => N.wire.emit('navigate.reload'));
  });


  // Remove a user from ignore list
  //
  N.wire.on('users.member:remove_ignore', function remove_ignore(data) {
    let user = data.$this.data('user-id');

    return N.io.rpc('users.settings.ignore.remove', { user })
      .then(() => N.wire.emit('notify', { type: 'info', message: t('ignore_removed') }))
      .then(() => N.wire.emit('navigate.reload'));
  });
});
