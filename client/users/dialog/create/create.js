// Create new dialog
//
'use strict';


const _ = require('lodash');


let options;
let bloodhound;


function updateOptions() {
  N.MDEdit.parseOptions(Object.assign({}, options.parse_options, {
    link_to_title:   options.user_settings.no_mlinks         ? false : options.parse_options.link_to_title,
    link_to_snippet: options.user_settings.no_mlinks         ? false : options.parse_options.link_to_snippet,
    quote_collapse:  options.user_settings.no_quote_collapse ? false : options.parse_options.quote_collapse,
    emoji:           options.user_settings.no_emojis         ? false : options.parse_options.emoji,
    breaks:          options.user_settings.breaks            ? true  : options.parse_options.breaks
  }));
}


// Load dependencies
//
N.wire.before(module.apiPath + ':begin', function load_deps() {
  return N.loader.loadAssets([ 'mdedit', 'vendor.typeahead' ]);
});


// Fetch options
//
N.wire.before(module.apiPath + ':begin', function fetch_options() {
  return N.io.rpc('users.dialog.options').then(opt => {
    options = {
      parse_options: opt.parse_options,
      user_settings: {
        no_mlinks:         opt.user_settings.no_mlinks,
        no_emojis:         opt.user_settings.no_emojis,
        no_quote_collapse: opt.user_settings.no_quote_collapse,
        breaks:            opt.user_settings.breaks
      }
    };
  });
});


// Show editor and add handlers for editor events
//
//  - params (Object) - specify recipient, text, etc. (optional)
//    - nick (String) - recipient nick
//    - hid  (Number) - recipient hid
//    - ref  (String) - used as a part of draft key (optional)
//    - text (String) - default content of the message box (optional)
//    - meta (Object) - additional arguments passed into RPC method (optional)
//
N.wire.on(module.apiPath + ':begin', function create_dialog(params) {
  params = params || {};

  const Bloodhound = require('corejs-typeahead/dist/bloodhound.js');

  // build draft key tail
  let key_tail = params.ref ? params.ref : (params.nick || '');

  let $editor = N.MDEdit.show({
    draftKey: `dialog_create_${N.runtime.user_hid}_${key_tail}`,
    draftCustomFields: {
      // Add `:last` because typeahead create additional field copy
      '.dialogs-create__user-nick-input:last': 'input'
    },
    text: params.text || ''
  });

  let $inputs = $(N.runtime.render(module.apiPath + '.inputs', {
    to: params.nick || ''
  }));

  let $to = $inputs.find('.dialogs-create__user-nick-input');

  updateOptions();

  $editor
    .on('show.nd.mdedit', () => {
      $editor.addClass('dialogs-create-editor');

      if (params.nick) {
        // If user is specified - show dialog without nick field
        //
        // - button in usercard
        // - button on profile page
        //
        $editor.find('.mdedit-header__caption').html(t('title_with_nick', {
          nick: params.nick,
          url: N.router.linkTo('users.member', { user_hid: params.hid })
        }));

      } else {
        // If to user is not specified - show dialog with nick field and modifier
        //
        // - button on dialogs root page
        //
        $editor.find('.mdedit-header__caption').html(t('title'));
        $editor.addClass('dialogs-create-editor__m-with-nick');
      }

      $editor.find('.mdedit-header').append($inputs);
      $editor.find('.mdedit-footer').append(N.runtime.render(module.apiPath + '.options_btn'));

      // If bloodhound not initialized - init
      //
      if (!bloodhound) {
        bloodhound = new Bloodhound({
          remote: {
            url: 'unused', // bloodhound throws if it's not defined
            prepare(nick) { return nick; },
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
    .on('submit.nd.mdedit', () => {
      $editor.find('.mdedit-btn__submit').addClass('disabled');

      let errors = false;

      if (!$.trim($to.val())) {
        $to.addClass('is-invalid');
        errors = true;
      } else {
        $to.removeClass('is-invalid');
      }

      if (errors) {
        $editor.find('.mdedit-btn__submit').removeClass('disabled');
        return false;
      }

      let dlg_create_params = {
        to:                       $to.val(),
        txt:                      N.MDEdit.text(),
        meta:                     params.meta,
        option_no_mlinks:         options.user_settings.no_mlinks,
        option_no_emojis:         options.user_settings.no_emojis,
        option_no_quote_collapse: options.user_settings.no_quote_collapse,
        option_breaks:            options.user_settings.breaks
      };

      N.io.rpc('users.dialog.create', dlg_create_params)
        .then(res => {
          N.MDEdit.hide({ removeDraft: true });
          N.wire.emit('navigate.to', {
            apiPath: 'users.dialog',
            params: {
              dialog_id: res.dialog_id,
              message_id: res.message_id
            }
          });
        })
        .catch(err => {
          $editor.find('.mdedit-btn__submit').removeClass('disabled');

          if (err.type === 'BAD_NICK') {
            $to.addClass('is-invalid');
          }

          return N.wire.emit('error', err);
        });

      return false;
    });
});


// Open options dialog
//
N.wire.on(module.apiPath + ':options', function show_options_dlg() {
  return N.wire.emit('common.blocks.editor_options_dlg', options.user_settings)
    .then(updateOptions)
    .then(() => N.io.rpc('users.set_md_options', options.user_settings));
});
