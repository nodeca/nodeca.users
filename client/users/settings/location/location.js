
'use strict';

let map;
let marker;


// Create a marker if it does not exist, set its position
//
function set_marker_position(lat, lng) {
  const leaflet = require('leaflet').noConflict();

  if (!map) return;

  if (marker) {
    marker.setLatLng({ lat, lng });
    return;
  }

  // copied from leaflet.Icon.Default.prototype.options with icon urls replaced
  let icon = leaflet.icon({
    iconUrl:       '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon.png")) $$',
    iconRetinaUrl: '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-icon-2x.png")) $$',
    shadowUrl:     '$$ JSON.stringify(asset_url("nodeca.core/client/vendor/leaflet/images/marker-shadow.png")) $$',
    iconSize:      [ 25, 41 ],
    iconAnchor:    [ 12, 41 ],
    popupAnchor:   [ 1, -34 ],
    tooltipAnchor: [ 16, -28 ],
    shadowSize:    [ 41, 41 ]
  });

  marker = leaflet.marker([], { icon, draggable: true });

  marker.setLatLng({ lat, lng });
  marker.addTo(map);

  // prevent marker from moving when user clicks on it
  marker.on('click', leaflet.DomEvent.stop);

  $('.user-settings-location__submit').prop('disabled', false);
}


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.leaflet');
});


N.wire.on('navigate.done:' + module.apiPath, function initialize_map() {
  const leaflet = require('leaflet').noConflict();

  let container = $('.user-settings-location__map');

  map = leaflet.map(container[0]);

  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(map);

  let Locator = leaflet.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      let container = $(N.runtime.render('users.settings.location.locator_btn'));
      let link = container.find('.user-settings-location__locator-btn')[0];

      // using code similar to leaflet core to make sure button behavior
      // is exactly the same as other buttons (zoom in/zoom out)
      leaflet.DomEvent
        .on(link, 'mousedown dblclick', leaflet.DomEvent.stopPropagation)
        .on(link, 'click', leaflet.DomEvent.stop)
        .on(link, 'click', function () {
          let error_catched = false;

          window.navigator.geolocation.getCurrentPosition(function success(position) {
            map.setView(
              [ position.coords.latitude, position.coords.longitude ],
              Math.max(10, map.getZoom())
            );
          }, function error(err) {
            if (error_catched) return;

            error_catched = true;

            let err_map = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

            if (err.code && err_map[err.code]) {
              N.wire.emit('notify', {
                type: 'error',
                message: t('err_geolocation_' + err_map[err.code])
              });
            }
          }, { timeout: 10000 });
        });

      return container[0];
    }
  });

  map.addControl(new Locator());

  if (N.runtime.page_data.location) {
    set_marker_position(
      N.runtime.page_data.location[0],
      N.runtime.page_data.location[1]
    );

    map.setView(N.runtime.page_data.location, 10);
  } else {
    // adjust position and zoom to fit the entire map in viewport
    map.setView([ 20, 0 ], container.width() > 600 ? 2 : 1);
  }

  let timer;
  let prevent_click = false;

  map.on('click', e => {
    // solution to avoid double-click triggering click event is similar to
    // https://css-tricks.com/snippets/javascript/bind-different-events-to-click-and-double-click/
    timer = setTimeout(function () {
      if (!prevent_click) {
        set_marker_position(e.latlng.lat, e.latlng.lng);
      }

      prevent_click = false;
    }, 300);
  });

  map.on('dblclick', () => {
    prevent_click = true;
    clearTimeout(timer);
  });
});


// Save marker position on the server when user clicks "save" button
//
N.wire.on(module.apiPath + ':save', function save_marker() {
  if (!marker) return;

  let latlng = marker.getLatLng();

  N.io.rpc('users.settings.location.update', {
    // normalize lng into [ -180, 180 ] range, lat should be correct as is
    latitude:  latlng.lat,
    longitude: latlng.lng > 0 ?
               ((latlng.lng + 180) % 360) - 180 :
               ((latlng.lng - 180) % 360) + 180
  }).then(() =>
    N.wire.emit('notify', {
      type: 'info',
      message: t('saved')
    })
  ).catch(err => N.wire.emit('error', err));
});


N.wire.on('navigate.exit:users.settings.location', function teardown_map() {
  if (marker) {
    marker.remove();
    marker = null;
  }

  if (map) {
    map.remove();
    map = null;
  }
});
