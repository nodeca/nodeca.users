'use strict';


N.wire.once('navigate.done:users.member', function page_once() {

  // Confirmation dialog
  //
  N.wire.before('users.member:hellban', function confirm_hellban() {
    return N.wire.emit('common.blocks.confirm', t('confirm_hellban'));
  });


  // Hellban user
  //
  N.wire.on('users.member:hellban', function hellban(data) {
    let user_id = data.$this.data('user-id');

    return  N.io.rpc('users.member.actions.hellban', { user_id, hellban: true })
      .then(() => N.wire.emit('notify', { type: 'info', message: t('msg_hellban_done') }))
      .then(() => N.wire.emit('navigate.reload'));
  });


  // Confirmation dialog
  //
  N.wire.before('users.member:unhellban', function confirm_unhellban() {
    return N.wire.emit('common.blocks.confirm', t('confirm_unhellban'));
  });


  // Remove user from hellbanned
  //
  N.wire.on('users.member:unhellban', function unhellban(data) {
    let user_id = data.$this.data('user-id');

    return N.io.rpc('users.member.actions.hellban', { user_id, hellban: false })
      .then(() => N.wire.emit('notify', { type: 'info', message: t('msg_unhellban_done') }))
      .then(() => N.wire.emit('navigate.reload'));
  });
});
