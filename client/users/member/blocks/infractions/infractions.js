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
      .then(() => N.wire.emit('navigate.reload'));
  });


  // Add infraction
  //
  N.wire.on(module.apiPath + ':add', function add_infraction(data) {
    let params = { user_id: data.$this.data('user-id') };

    return Promise.resolve()
      .then(() => N.wire.emit('users.blocks.add_infraction_dlg', params))
      .then(() => N.io.rpc('users.member.blocks.infractions.create', params))
      .then(() => N.wire.emit('notify.info', t('infraction_added')))
      .then(() => N.wire.emit('navigate.reload'));
  });
});


// Highlight and scroll to infraction for /memberX#infractionY links
//
N.wire.on('navigate.done:users.member', function highlight_infraction(data) {
  let anchor = data.anchor || '';
  let m = anchor.match(/^#infraction([0-9a-f]{24})$/);

  if (m) {
    let el = $('#infraction' + m[1]);

    if (el.length) {
      // override automatic scroll to an anchor in the navigator
      data.no_scroll = true;

      el[0].scrollIntoView();
      el.addClass('member-infractions-item__m-highlight');
      return;
    }
  }
});
