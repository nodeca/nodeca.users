// Allows to invoke `users.set_language` server method using data-on-* and
// data-locale attributes on DOM elements.
//
//   <button data-on-click="users.set_language" data-locale="ru-RU">
//     Switch to Russian language
//   </button>


'use strict';


N.wire.on(module.apiPath, function (event, callback) {
  var locale = $(event.currentTarget).data('locale');

  if (!locale) {
    callback(new Error('Missed locale name.'));
    return;
  }

  if (locale === N.runtime.locale) {
    callback(); // Not changed.
    return;
  }

  N.io.rpc(module.apiPath, { locale: locale }, function (err) {
    if (err) {
      return false;
    }

    // Reload the page in order to apply new locale.
    window.location.reload();
  });
});
