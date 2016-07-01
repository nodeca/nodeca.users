'use strict';


const parse_options = require('nodeca.users/server/users/mod_notes/_parse_options');
const _             = require('lodash');
const bag           = require('bagjs')({ prefix: 'nodeca' });


let draft;
let draftKey;


// Load mdedit
//
N.wire.before(module.apiPath + ':edit', function load_mdedit(__, callback) {
  N.loader.loadAssets('mdedit', callback);
});


// Fetch draft data
//
N.wire.before(module.apiPath + ':edit', function fetch_draft(data) {
  draft = {};
  draftKey = '';

  let note_id = data.$this.data('note-id');

  // No drafts in edit mode
  if (note_id) return;

  // Current user
  let from_hid = N.runtime.user_hid;

  // User whose profile is being edited
  let to_hid = data.$this.data('user-hid');

  draftKey = [ 'mod_notes', from_hid, to_hid ].join('_');

  return bag.get(draftKey)
    .then(data => {
      draft = data || {};
    })
    .catch(() => {
    }); // Suppress storage errors
});


// Show editor and add handlers for editor events
//
N.wire.on(module.apiPath + ':edit', function show_editor(data) {
  let user_nick = data.$this.data('user-nick');
  let user_hid = data.$this.data('user-hid');
  let orig_text = data.$this.data('md');
  let note_id = data.$this.data('note-id');


  let $editor = N.MDEdit.show({
    text: String(orig_text || draft.text || ''),
    toolbar: 'usernote',
    parse_options
  });

  $editor
    .on('show.nd.mdedit', () => {
      let title = t('editor_title', {
        nick: _.escape(user_nick),
        url: N.router.linkTo('users.member', { user_hid })
      });

      $editor.find('.mdedit-header__caption').html(title);
    })
    .on('change.nd.mdedit', () => {
      if (draftKey) {
        // Expire after 7 days
        bag.set(draftKey, {
          text: N.MDEdit.text()
        }, 7 * 24 * 60 * 60);
      }
    })
    .on('submit.nd.mdedit', () => {
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
          if (draftKey) {
            return bag.remove(draftKey)
              .catch(() => {}); // Suppress storage errors
          }
        })
        .then(() => {
          N.MDEdit.hide();

          return N.wire.emit('navigate.to', {
            apiPath: 'users.mod_notes',
            params: {
              user_hid
            },
            force: true
          });
        })
        .then(() => N.wire.emit('notify', { type: 'info', message: t('updated_notice') }))
        .catch(err => N.wire.emit('error', err));

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
