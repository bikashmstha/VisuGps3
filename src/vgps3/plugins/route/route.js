/**
 * Copyright 2012 Victor Berchet
 *
 * This file is part of VisuGps3
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 */

/**
 * @fileoverview Displays a route.
 * @author Victor Berchet <victor@suumit.com>
 */

goog.provide('vgps3.route.Route');

goog.require('vgps3.IPlugin');
goog.require('vgps3.Map');



/**
 *
 * @constructor
 * @implements {vgps3.IPlugin}
 */
vgps3.route.Route = function() {
  /**
  * @type {google.maps.Map} The google map.
  * @private
  */
  this.gMap_;
};


/**
 * @override
 */
vgps3.route.Route.prototype.init = function(vgps) {
  this.gMap_ = vgps.getGoogleMap();
};


/**
 *
 * @param {string} type End with "c" to display a closed route.
 * @param {Array.<google.maps.LatLng>} turnpoints
 * @param {google.maps.LatLng=} opt_start
 * @param {google.maps.LatLng=} opt_end
 */
vgps3.route.Route.prototype.draw = function(type, turnpoints, opt_start, opt_end) {
  var startIcon = new google.maps.MarkerImage(vgps3.route.START_ICON_URL, new google.maps.Size(12, 20)),
      endIcon = new google.maps.MarkerImage(vgps3.route.END_ICON_URL, new google.maps.Size(12, 20)),
      icon = new google.maps.MarkerImage(vgps3.route.ICON_URL, new google.maps.Size(12, 20)),
      closed = type.length && type.substr(-1) === 'c';

  new google.maps.Polyline({
    clickable: false,
    map: this.gMap_,
    path: turnpoints,
    strokeColor: '#00f',
    strokeOpacity: 0.8,
    strokeWeight: 1
  });

  if (closed && goog.isDef(opt_start)) {
    new google.maps.Polyline({
      clickable: false,
      map: this.gMap_,
      path: [opt_start, turnpoints[0]],
      strokeColor: '#222',
      strokeOpacity: 0.8,
      strokeWeight: 1
    });
  }

  if (closed && goog.isDef(opt_end)) {
    new google.maps.Polyline({
      clickable: false,
      map: this.gMap_,
      path: [opt_end, turnpoints[turnpoints.length - 1]],
      strokeColor: '#222',
      strokeOpacity: 0.8,
      strokeWeight: 1
    });
  }

  new google.maps.Marker({
    clickable: false,
    position: closed && goog.isDef(opt_start) ? opt_start : turnpoints[0],
    map: this.gMap_,
    icon: startIcon
  });
  new google.maps.Marker({
    clickable: false,
    position: closed && goog.isDef(opt_end) ? opt_end : turnpoints[turnpoints.length - 1],
    map: this.gMap_,
    icon: endIcon
  });

  closed && turnpoints.push(turnpoints[0]);

  goog.array.forEach(
      closed ? turnpoints : goog.array.slice(turnpoints, 1, -1),
      function(tp) {
        new google.maps.Marker({clickable: false, position: tp, map: this.gMap_, icon: icon});
      },
      this
  );
};


/**
 * @define {string} The start icon url.
 */
vgps3.route.START_ICON_URL = 'http://labs.google.com/ridefinder/images/mm_20_green.png';


/**
 * @define {string} The end icon url.
 */
vgps3.route.END_ICON_URL = 'http://labs.google.com/ridefinder/images/mm_20_red.png';


/**
 * @define {string} The route icon url.
 */
vgps3.route.ICON_URL = 'http://labs.google.com/ridefinder/images/mm_20_orange.png';

goog.exportSymbol('vgps3.route.Route', vgps3.route.Route);
goog.exportSymbol('vgps3.route.Route.init', vgps3.route.Route.prototype.init);
