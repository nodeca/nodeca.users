'use strict';


const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');
const _             = require('lodash');


// Load mdedit
//
N.wire.before(module.apiPath + ':edit', function load_mdedit() {
  return N.loader.loadAssets('mdedit');
});


// Show editor and add handlers for editor events
//
N.wire.on(module.apiPath + ':edit', function show_editor(data) {
  let user_nick = data.$this.data('user-nick');
  let user_hid = data.$this.data('user-hid');
  let orig_text = data.$this.data('md');
  let note_id = data.$this.data('note-id');

  let $editor = N.MDEdit.show({
    // Don't use drafts when edit
    draftKey: note_id ? null : [ 'mod_notes', N.runtime.user_hid, user_hid ].join('_'),
    text: orig_text,
    toolbar: 'usernote',
    parseOptions: parse_options
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
      $editor.find('.mdedit-btn__submit').addClass('disabled');

      let rpc_method, rpc_params, txt = N.MDEdit.text();

      if (note_id) {
        if (txt.trim()) {
          rpc_method = 'users.mod_notes.update';
          rpc_params = { note_id, txt };
        } else {
          // if the note is empty, delete it instead
          rpc_method = 'users.mod_notes.destroy';
          rpc_params = { note_id };
        }
      } else if (txt.trim()) {
        rpc_method = 'users.mod_notes.create';
        rpc_params = { user_hid, txt };
      } else {
        // if the note is empty, do nothing
        N.MDEdit.hide();
        return;
      }

      N.io.rpc(rpc_method, rpc_params)
        .then(() => {
          N.MDEdit.hide({ removeDraft: true });

          return N.wire.emit('navigate.to', {
            apiPath: 'users.mod_notes',
            params: {
              user_hid
            },
            force: true
          });
        })
        .then(() => N.wire.emit('notify', { type: 'info', message: t('updated_notice') }))
        .catch(err => {
          $editor.find('.mdedit-btn__submit').removeClass('disabled');
          N.wire.emit('error', err);
        });

      return false;
    });
});


N.wire.once('navigate.done:' + module.apiPath, function init_mod_notes() {

  // Confirmation dialog
  //
  N.wire.before(module.apiPath + ':delete', function delete_note() {
    return N.wire.emit('common.blocks.confirm', t('delete_confirm'));
  });


  // Remove a note
  //
  N.wire.on(module.apiPath + ':delete', function delete_note(data) {
    let note_id = data.$this.data('note-id');

    return N.io.rpc('users.mod_notes.destroy', { note_id })
      .then(() => N.wire.emit('navigate.reload'));
  });
});
