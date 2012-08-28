'use strict';


var DELAY       = 750;  // Time in ms before showing an info card
var TIMEOUT     = null; // Timeout ID used to interrupt previous timeout if any
var POPOVER_IDX = 0;    // Popover counters used to generate unique IDs


// Returns user info card from cache.
// Request from server if it's not yet cahed or cache outdated.
//
function getUserInfo(id, callback) {
  nodeca.io.apiTree('users.usercard_popover', { id: id }, function (err, resp) {
    callback(err ? null : (resp.data || {}).user);
  });
}


// Dummy helper to render usercard_popover view with given data
//
function render(data) {
  return nodeca.client.common.render('common.widgets.usercard_popover', data);
}


////////////////////////////////////////////////////////////////////////////////


$.fn.powerTip.smartPlacementLists.usercard = [ 'nw-alt', 'sw-alt', 'ne-alt', 'se-alt' ];


////////////////////////////////////////////////////////////////////////////////


module.exports = function active_profiles() {
  $('body').on('hover.nodeca.data-api', 'a.usercard-popover', function (event) {
    var $this = $(this),
        id    = $this.data('user-id'),
        card  = $this.data('powertip');

    clearTimeout(TIMEOUT);

    if (!id || 'mouseleave' === event.type || card) {
      return;
    }

    TIMEOUT = setTimeout(function () {
      var popover_id = 'usercard_popover_' + POPOVER_IDX++;

      $this.data('powertip', render({ popover_id: popover_id, loading: true }));

      // assign powertip handlers
      $this.powerTip({
        placement:          'usercard',
        smartPlacement:     true,
        mouseOnToPopup:     true,
        fadeOutTime:        150,
        intentPollInterval: DELAY
      });

      // show popover
      $.powerTip.showTip($this);

      // fetch data
      getUserInfo(id, function (data) {
        $.powerTip.closeTip();
        $this.powerTip('destroy');

        if (!data) {
          // no user -- destroy powertip and set powertip data attribute
          // to not reinitiate it next time
          $this.data('powertip', true);
          return;
        }

        // set powertip contents
        $this.data('powertip', render($.extend(data, { popover_id: popover_id })));

        // assign powertip handlers
        $this.powerTip({
          placement:          'usercard',
          smartPlacement:     true,
          mouseOnToPopup:     true,
          fadeInTime:         150,
          intentPollInterval: DELAY
        });

        $.powerTip.showTip($this);
      });
    }, DELAY);
  });
};
