'use strict';

/*global N, window*/


var _ = require('lodash');
var $ = window.jQuery;


var DELAY       = 500;  // Time in ms before showing an info card
var TIMEOUT     = null; // Timeout ID used to interrupt previous timeout if any
var POPOVER_IDX = 0;    // Popover counters used to generate unique IDs


// Returns user info card from cache.
// Request from server if it's not yet cached or cache outdated.
//
function getUserInfo(id, callback) {
  N.io.rpc(module.apiPath, { id: id }, function (err, resp) {
    callback(err ? null : (resp.data || {}).user);
  });
}


////////////////////////////////////////////////////////////////////////////////


$.fn.powerTip.smartPlacementLists.usercard = [
  'nw-alt', 'sw-alt', 'ne-alt', 'se-alt', 'nw-alt'
];


////////////////////////////////////////////////////////////////////////////////


$(function () {
  $('body').on('mouseenter.nodeca.data-api', '.usercard-popover', function () {
    var $this = $(this),
        id    = $this.data('user-id'),
        card  = $this.data('powertip');

    clearTimeout(TIMEOUT);

    if (!id || card) {
      return;
    }

    TIMEOUT = setTimeout(function () {
      var popover_id = 'usercard_popover_' + POPOVER_IDX++;

      $this.data('powertip', N.runtime.render(module.apiPath, {
        popover_id: popover_id,
        loading: true
      }));

      // assign powertip handlers
      $this.powerTip({
        placement:          'usercard',
        smartPlacement:     true,
        mouseOnToPopup:     true,
        popupId:            'ucard-popover',
        offset:             15,
        closeDelay:         500,
        intentPollInterval: DELAY
      });

      // show popover
      $.powerTip.showTip($this);

      // fetch data
      getUserInfo(id, function (data) {
        var html;

        if (!data) {
          // no user -- destroy powertip and set powertip data attribute
          // to not reinitiate it next time
          $this.powerTip('destroy').data('powertip', true);
          return;
        }

        html = N.runtime.render(module.apiPath, _.extend(data, {
          popover_id: popover_id
        }));

        // set powertip contents
        $this.data('powertip', html);

        // try to replace already shown "loading" stub
        $('#' + popover_id).replaceWith(html);

        $.powerTip.resetPosition($this);
      });
    }, DELAY);
  });
});
