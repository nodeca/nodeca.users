// Create new dialog
//
'use strict';


const _ = require('lodash');


let options;
let bloodhound;


function updateOptions() {
  N.MDEdit.parseOptions(_.assign({}, options.parse_options, {
    link_to_title:   options.user_settings.no_mlinks         ? false : options.parse_options.link_to_title,
    link_to_snippet: options.user_settings.no_mlinks         ? false : options.parse_options.link_to_snippet,
    quote_collapse:  options.user_settings.no_quote_collapse ? false : options.parse_options.quote_collapse,
    emoji:           options.user_settings.no_emojis         ? false : options.parse_options.emoji
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
        no_mlinks: false,
        no_emojis: false,
        no_quote_collapse: false
      }
    };
  });
});


// Show editor and add handlers for editor events
//
N.wire.on(module.apiPath + ':begin', function create_dialog(to_user) {
  const Bloodhound = require('corejs-typeahead/dist/bloodhound.js');

  let $editor = N.MDEdit.show({
    draftKey: [ 'dialog_create', N.runtime.user_hid, to_user ? to_user.nick : '' ].join('_'),
    draftCustomFields: {
      '.dialogs-create__title': 'input',
      // Add `:last` because typeahead create additional field copy
      '.dialogs-create__user-nick-input:last': 'input'
    }
  });

  let $inputs = $(N.runtime.render(module.apiPath + '.inputs', {
    to: to_user ? to_user.nick : ''
  }));

  let $to = $inputs.find('.dialogs-create__user-nick-input');
  let $title = $inputs.find('.dialogs-create__title');

  updateOptions();

  $editor
    .on('show.nd.mdedit', () => {
      $editor.addClass('dialogs-create-editor');

      if (to_user) {
        // If to user is specified - show dialog without nick field
        //
        // - button in usercard
        // - button on profile page
        //
        $editor.find('.mdedit-header__caption').html(t('title_with_nick', {
          nick: to_user.nick,
          url: N.router.linkTo('users.member', { user_hid: to_user.hid })
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
        $to.parent().addClass('has-danger');
        errors = true;
      } else {
        $to.parent().removeClass('has-danger');
      }

      if (!$.trim($title.val())) {
        $title.parent().addClass('has-danger');
        errors = true;
      } else {
        $title.parent().removeClass('has-danger');
      }

      if (errors) {
        $editor.find('.mdedit-btn__submit').removeClass('disabled');
        return false;
      }

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
            $to.parent().addClass('has-danger');
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
