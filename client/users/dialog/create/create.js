// Create new dialog
//
'use strict';


const _          = require('lodash');
const bag        = require('bagjs')({ prefix: 'nodeca' });
const Bloodhound = require('typeahead.js/dist/bloodhound.js');


let options;
let draft;
let draftKey;
let bloodhound;


function updateOptions() {
  N.MDEdit.parseOptions(_.assign({}, options.parse_options, {
    link_to_title:   options.user_settings.no_mlinks         ? false : options.parse_options.link_to_title,
    link_to_snippet: options.user_settings.no_mlinks         ? false : options.parse_options.link_to_snippet,
    quote_collapse:  options.user_settings.no_quote_collapse ? false : options.parse_options.quote_collapse,
    emoji:           options.user_settings.no_emojis         ? false : options.parse_options.emoji
  }));
}


// Load mdedit
//
N.wire.before(module.apiPath + ':begin', function load_mdedit(__, callback) {
  N.loader.loadAssets('mdedit', callback);
});


// Fetch options
//
N.wire.before(module.apiPath + ':begin', function fetch_options() {
  return N.io.rpc('users.dialog.options').then(opt => {
    options = {
      parse_options: opt.parse_options,
      user_settings: {
        no_mlinks: false,
        no_emojis: false,
        no_quote_collapse: false
      }
    };
  });
});


// Fetch draft data
//
N.wire.before(module.apiPath + ':begin', function fetch_draft() {
  draftKey = `dialog_create_${N.runtime.user_hid}`;
  draft = {};

  return bag.get(draftKey)
    .then(data => {
      draft = data || {};
    })
    .catch(() => {}); // Suppress storage errors
});


// Check draft attachments
//
N.wire.before(module.apiPath + ':begin', function check_draft_attachments() {
  if (!draft.attachments || draft.attachments.length === 0) return;

  let params = { media_ids: _.map(draft.attachments, 'media_id') };

  return N.io.rpc('users.dialog.attachments_check', params).then(res => {
    draft.attachments = draft.attachments.filter(attach => res.media_ids.indexOf(attach.media_id) !== -1);
  });
});


// Show editor and add handlers for editor events
//
N.wire.on(module.apiPath + ':begin', function create_dialog(data) {
  let $editor = N.MDEdit.show({
    text: draft.text,
    attachments: draft.attachments
  });
  let $inputs = $(N.runtime.render(module.apiPath + '.inputs', {
    title: draft.title,
    to: (data || {}).to || draft.to
  }));
  let $to = $inputs.find('.dialogs-create__to');
  let $title = $inputs.find('.dialogs-create__title');

  updateOptions();

  $editor
    .on('show.nd.mdedit', () => {
      $editor.find('.mdedit-header__caption').html(t('new_message'));
      $editor.find('.mdedit-header').append($inputs);
      $editor.find('.mdedit-footer').append(N.runtime.render(module.apiPath + '.options_btn'));


      // If bloodhound not initialized - init
      //
      if (!bloodhound) {
        bloodhound = new Bloodhound({
          remote: {
            // Hack to get nick in first param of transport call
            url: '%QUERY',
            wildcard: '%QUERY',
            // Reroute request to rpc
            transport(req, onSuccess, onError) {
              N.io.rpc('common.user_lookup', { nick: req.url })
                .then(onSuccess)
                .catch(onError);
            }
          },
          datumTokenizer(d) {
            return Bloodhound.tokenizers.whitespace(d.nick);
          },
          queryTokenizer: Bloodhound.tokenizers.whitespace
        });

        bloodhound.initialize();
      }


      // Bind typeahead to nick field
      //
      $to.typeahead({ highlight: true }, {
        source: bloodhound.ttAdapter(),
        display: 'nick',
        templates: {
          suggestion(user) {
            return '<div>' + _.escape(user.name) + '</div>';
          }
        }
      });
    })
    .on('change.nd.mdedit', () => {
      // Expire after 7 days
      bag.set(draftKey, {
        to: $to.val(),
        title: $title.val(),
        text: N.MDEdit.text(),
        attachments: N.MDEdit.attachments()
      }, 7 * 24 * 60 * 60).catch(() => {}); // Suppress storage errors
    })
    .on('submit.nd.mdedit', () => {
      let errors = false;

      if (!$.trim($to.val())) {
        $to.parent().addClass('has-error');
        errors = true;
      } else {
        $to.parent().removeClass('has-error');
      }

      if (!$.trim($title.val())) {
        $title.parent().addClass('has-error');
        errors = true;
      } else {
        $title.parent().removeClass('has-error');
      }

      if (errors) return false;

      let params = {
        to:                       $to.val(),
        title:                    $title.val(),
        txt:                      N.MDEdit.text(),
        attach:                   _.map(N.MDEdit.attachments(), 'media_id'),
        option_no_mlinks:         options.user_settings.no_mlinks,
        option_no_emojis:         options.user_settings.no_emojis,
        option_no_quote_collapse: options.user_settings.no_quote_collapse
      };

      N.io.rpc('users.dialog.create', params)
        .then(res => {
          N.MDEdit.hide();
          N.wire.emit('navigate.to', {
            apiPath: 'users.dialog',
            params: {
              dialog_id: res.dialog_id,
              message_id: res.message_id
            }
          });
        })
        .then(() => bag.remove(draftKey).catch(() => {})) // Suppress storage errors
        .catch(err => {
          if (err.type === 'BAD_NICK') {
            $to.parent().addClass('has-error');
          }

          return N.wire.emit('error', err);
        });

      return false;
    });
});


// Open options dialog
//
N.wire.on(module.apiPath + ':options', function show_options_dlg() {
  return N.wire.emit('common.blocks.editor_options_dlg', options.user_settings).then(updateOptions);
});
