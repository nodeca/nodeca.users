

'use strict';

const Pikaday = require('pikaday');

let picker;


N.wire.on('navigate.done:users.settings.about', function initialize_datepicker() {
  let cldr          = N.runtime.t('l10n.cldr').dates.calendars.gregorian;
  let months        = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(key =>
                        cldr.months['stand-alone'].wide[key]);
  let weekdays      = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].wide[key]);
  let weekdaysShort = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ].map(key =>
                        cldr.days['stand-alone'].abbreviated[key]);

  picker = new Pikaday({
    field:     $('.user-settings-about-birthday')[0],
    yearRange: [ 1900, new Date().getFullYear() ],
    i18n:      { months, weekdays, weekdaysShort }
  });
});


N.wire.on('navigate.exit:users.settings.about', function teardown_datepicker() {
  if (picker) {
    picker.destroy();
    picker = null;
  }
});
