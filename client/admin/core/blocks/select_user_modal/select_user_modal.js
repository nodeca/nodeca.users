'use strict';


var _ = require('lodash');


var DEFAULT_ELEMENT_ID = '#select_user_modal';

var INPUT_AUTOCOMPLETE_MIN_LENGTH = 2;
var INPUT_AUTOCOMPLETE_DELAY      = 500;


N.wire.on(module.apiPath + '.setup', function (options) {
  options = options || {};

  var $element = $(options.id || DEFAULT_ELEMENT_ID);

  // Initialize modal.
  $element.modal({ show: false });

  // Set default callback. (may be changed at `show` event)
  $element.data('callback', options.callback || null);

  // Set default title. (may be changed at `show` event)
  $element.find('h4').text(options.title || t('title'));

  // Initialize jQuery UI's Autocomplete widget.
  $element.find('input').autocomplete({
    appendTo:  $element
  , minLength: INPUT_AUTOCOMPLETE_MIN_LENGTH
  , delay:     INPUT_AUTOCOMPLETE_DELAY
  , source: function (request, suggestions) {
      N.io.rpc('admin.core.find_user', { search: request.term }, function (err, response) {
        if (err) {
          suggestions();
          return false; // Invoke standard error handling.
        }

        suggestions(_.map(response.data.users, function (user) {
          return {
            label: user._uname
          , value: user._id
          };
        }));
      });
    }
  , focus: function (event) {
      // Don't touch user's input on focus. (select in autocomplete list)
      event.preventDefault();
    }
  , select: function (event, ui) {
      event.preventDefault();
      $(this).val(ui.item.label);

      var callback = $element.data('callback');

      if (!callback) {
        window.alert('Internal error. This modal has no assigned callback.');
        return;
      }

      callback({
        _id:    ui.item.value
      , _uname: ui.item.label
      });
    }
  });

  $element.on('shown', function () {
    $element.find('input').focus();
  });

  // Reset search input text when modal is hidden.
  $element.on('hidden', function () {
    $element.find('input').val('');
  });
});


N.wire.on(module.apiPath + '.teardown', function (options, callback) {
  N.wire.emit(module.apiPath + '.hide', options, callback);
});


N.wire.on(module.apiPath + '.show', function (options) {
  options = options || {};

  var $element = $(options.id || DEFAULT_ELEMENT_ID);

  // Update title.
  if (_.has(options, 'title')) {
    $element.find('h4').text(options.title);
  }

  // Update callback.
  if (_.has(options, 'callback')) {
    $element.data('callback', options.callback);
  }

  $element.modal('show');
});


N.wire.on(module.apiPath + '.hide', function (options) {
  options = options || {};

  $(options.id || DEFAULT_ELEMENT_ID).modal('hide');
});
