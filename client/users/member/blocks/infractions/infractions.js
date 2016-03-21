'use strict';


// Init infractions block
//
N.wire.once('navigate.done:users.member', function init_infractions() {


  // Delete infraction
  //
  N.wire.on(module.apiPath + ':delete', function delete_infraction(data) {
    let params = { infraction_id: data.$this.data('infraction-id') };

    return Promise.resolve()
      .then(() => N.wire.emit(module.apiPath + '.infraction_delete_dlg', params))
      .then(() => N.io.rpc('users.member.blocks.infractions.destroy', params))
      .then(() => {
        data.$this.closest('.member-infractions-item').remove();
      });
  });


  // Add infraction
  //
  N.wire.on(module.apiPath + ':add', function add_infraction(data) {
    let params = { user_id: data.$this.data('user-id') };

    return Promise.resolve()
      .then(() => N.wire.emit('users.blocks.add_infraction_dlg', params))
      .then(() => N.io.rpc('users.member.blocks.infractions.create', params))
      .then(() => N.wire.emit('notify', { type: 'info', message: t('infraction_added') }))
      .then(() => N.wire.emit('navigate.reload'));
  });
});
