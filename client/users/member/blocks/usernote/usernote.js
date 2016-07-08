'use strict';


const _   = require('lodash');

// if we're on profile page, it equals to the hid of the user
// profile page belongs to; otherwise it's 0
let profile_user_hid = 0;


N.wire.on('navigate.done:users.member', function usernotes_setup(data) {
  profile_user_hid = data.params.user_hid;
});

N.wire.on('navigate.exit:users.member', function usernotes_teardown() {
  profile_user_hid = 0;
});


// Init user notes
//
N.wire.once('navigate.done:users.member', function init_usernotes() {
  let parseOptions = {
    code:           true,
    emoji:          true,
    emphasis:       true,
    heading:        true,
    hr:             true,
    image:          true,
    link:           true,
    link_to_title:  true,
    list:           true,
    quote:          true,
    quote_collapse: true,
    sub:            true,
    sup:            true
  };


  // Load mdedit
  //
  N.wire.before(module.apiPath + ':edit', function load_mdedit(__, callback) {
    N.loader.loadAssets('mdedit', callback);
  });


  // Show editor and add handlers for editor events
  //
  N.wire.on(module.apiPath + ':edit', function show_editor(data) {
    let user_hid     = data.$this.data('user-hid');
    let user_nick    = data.$this.data('user-nick');
    let orig_text    = data.$this.data('md');
    let orig_version = data.$this.data('version');

    let $editor = N.MDEdit.show({
      draftKey: [ 'usernote', N.runtime.user_hid, user_hid, orig_version ].join('_'),
      text: orig_text,
      toolbar: 'usernote',
      parseOptions
    });

    $editor
      .on('show.nd.mdedit', () => {
        let title = t('editor_title', {
          nick: _.escape(user_nick),
          url: N.router.linkTo('users.member', { user_hid })
        });

        $editor.find('.mdedit-header__caption').html(title);
      })
      .on('submit.nd.mdedit', () => {
        let rpc_method, rpc_params, txt = N.MDEdit.text();

        if (txt.trim()) {
          rpc_method = 'users.member.blocks.usernote.update';
          rpc_params = { user_hid, txt };
        } else {
          // if the note is empty, delete it instead
          rpc_method = 'users.member.blocks.usernote.delete';
          rpc_params = { user_hid };
        }

        N.io.rpc(rpc_method, rpc_params).then(() => {
          N.MDEdit.hide({ removeDraft: true });

          if (profile_user_hid === user_hid) {
            // if we're still on the same page, update
            return N.wire.emit('navigate.reload');
          }

          // otherwise show a completion message to user
          return N.wire.emit('notify', { type: 'info', message: t('update_notice') });
        }).catch(err => N.wire.emit('error', err));

        return false;
      });
  });


  // Confirmation dialog
  //
  N.wire.before(module.apiPath + ':remove', function remove_note() {
    return N.wire.emit('common.blocks.confirm', t('remove_confirm'));
  });


  // Remove a note
  //
  N.wire.on(module.apiPath + ':remove', function remove_note(data) {
    let user_hid = data.$this.data('user-hid');

    return N.io.rpc('users.member.blocks.usernote.delete', { user_hid })
      .then(() => N.wire.emit('navigate.reload'));
  });
});
