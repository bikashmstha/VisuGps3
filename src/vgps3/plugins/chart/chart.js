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
 * @fileoverview
 * @author Victor Berchet <victor@suumit.com>
 */

goog.provide('vgps3.chart.Chart');

goog.require('goog.async.Deferred');
goog.require('goog.debug.Logger');
goog.require('goog.events');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.MouseWheelHandler');
goog.require('goog.events.MouseWheelHandler.EventType');
goog.require('goog.net.jsloader');
goog.require('goog.style');
goog.require('goog.ui.Slider');
goog.require('vgps3.IPlugin');
goog.require('vgps3.Map');
goog.require('vgps3.chart.AboutEvent');
goog.require('vgps3.chart.ClickEvent');
goog.require('vgps3.chart.MoveEvent');
goog.require('vgps3.chart.Overlays');
goog.require('vgps3.chart.Sliders');
goog.require('vgps3.chart.WheelEvent');
goog.require('goog.dom');
goog.require('goog.debug.Trace');

/**
 * @param {!Element} container
 *
 * @constructor
 * @implements {vgps3.IPlugin}
 */
vgps3.chart.Chart = function(container) {
  /**
  * @type {vgps3.Map}
  * @private
  */
  this.vgps_;

  /**
  * @type {goog.events.MouseWheelHandler}
  * @private
  */
  this.mouseWheelHandler_;

  /**
  * @type {vgps3.chart.Overlays}
  * @private
  */
  this.overlays_ = new vgps3.chart.Overlays();

  /**
  * @type {vgps3.chart.Sliders}
  * @private
  */
  this.sliders_ = new vgps3.chart.Sliders();

  /**
   * @typedef {[{
   *   fixes: vgps3.track.GpsFixes,
   *   dataView: google.visualization.DataView
   * }]}
   * @private
   */
  this.chartData_ = [];

  /**
   * @typedef {{
   *     elevation: Node,
   *     speed: Node,
   *     vario: Node
   *   }}
   * @private
   */
  this.chartContainers_;

  /**
   * @type {Object.<string, *>}
   * @private
   */
  this.charts_;

  /**
   * @type {number}
   * @private
   */
  this.currentTrackIndex_;

  /**
   * @type {goog.debug.Logger}
   * @private
   */
  this.logger_ = goog.debug.Logger.getLogger('vgps3.chart.Chart');

  /**
  * @type {goog.async.Deferred}
  * @private
  */
  this.chartLoaded_ = new goog.async.Deferred();

  if (google && google.load) {
    this.apiLoadHandler_();
  } else {
    goog.net.jsloader.load(vgps3.chart.LOADER_URL).addCallback(this.apiLoadHandler_, this);
  }
};


/**
 * @override
 */
vgps3.chart.Chart.prototype.init = function(vgps) {
  this.vgps_ = vgps;

  this.vgps_.addEventListener(vgps3.track.EventType.LOAD, goog.bind(this.mapLoadHandler_, this));
  this.vgps_.addEventListener(vgps3.track.EventType.SELECT, goog.bind(this.mapSelectHandler_, this));
};


/**
 * @param {number} position [0...1].
 */
vgps3.chart.Chart.prototype.moveTo = function(position) {
  this.overlays_.moveTo(position);
};


/**
 * @param {goog.events.BrowserEvent} event
 * @private
 */
vgps3.chart.Chart.prototype.handleMouseEvents_ = function(event)
    {
  event.preventDefault();

  this.vgps_.dispatchEvent(
      event.type === goog.events.EventType.MOUSEDOWN
            ? new vgps3.chart.ClickEvent(this.overlays_.getPosition())
            : new vgps3.chart.MoveEvent(this.overlays_.getPosition())
  );
};


/**
 * @param {goog.events.MouseWheelEvent} event
 * @private
 */
vgps3.chart.Chart.prototype.handleMouseWheel_ = function(event) {
  event.preventDefault();

  this.vgps_.dispatchEvent(new vgps3.chart.WheelEvent(this.overlays_.getPosition(), event.deltaY > 0 ? 1 : -1));
};


/**
 * @param {vgps3.track.LoadEvent} event
 * @private
 */
vgps3.chart.Chart.prototype.mapLoadHandler_ = function(event) {
  var that = this;

  if (!goog.isDef(this.currentTrackIndex_)) {
    this.overlays_.render(goog.dom.getElement('charts'));
    this.sliders_.render(goog.dom.getElement('sliders'));

    this.chartContainers_ = {
      elevation: this.overlays_.addLayer(),
      speed: this.overlays_.addLayer(),
      vario: this.overlays_.addLayer()
    };

    this.sliders_.addSlider('h', this.chartContainers_.elevation, 'red');
    this.sliders_.addSlider('Vx', this.chartContainers_.speed, 'green');
    this.sliders_.addSlider('Vz', this.chartContainers_.vario, 'blue');

    this.mouseWheelHandler_ = new goog.events.MouseWheelHandler(this.overlays_.getElement());

    goog.events.listen(
        this.mouseWheelHandler_,
        goog.events.MouseWheelHandler.EventType.MOUSEWHEEL,
        goog.bind(this.handleMouseWheel_, this)
    );

    goog.events.listen(
        this.overlays_.getElement(),
        [goog.events.EventType.MOUSEDOWN, goog.events.EventType.MOUSEMOVE],
        goog.bind(this.handleMouseEvents_, this)
    );

    goog.events.listen(
        this.sliders_.getTitleElement(),
        goog.events.EventType.CLICK,
        function() { that.vgps_.dispatchEvent(new vgps3.chart.AboutEvent()); }
    );

    this.currentTrackIndex_ = event.index;
  }

  this.chartData_[event.index] = {fixes: event.track};
};


/**
 * @param {vgps3.track.TrackSelectEvent} event
 * @private
 */
vgps3.chart.Chart.prototype.mapSelectHandler_ = function(event) {
  this.chartLoaded_.addCallback(function() {
      if (!goog.isDef(this.chartData_[event.index].dataView)) {
        this.chartData_[event.index].dataView = this.createDataView_(event.index);
      }

      if (!goog.isDef(this.charts_)) {
        this.charts_ = {
          elevation: new google.visualization.AreaChart(this.chartContainers_.elevation),
          speed: new google.visualization.LineChart(this.chartContainers_.speed),
          vario: new google.visualization.LineChart(this.chartContainers_.vario)
        };
      }

      goog.debug.Trace.reset(0);
      var tracer = goog.debug.Trace.startTracer('Rendering charts');
      this.drawChart_('elevation', event.index, [0, 1, 2]);
      goog.debug.Trace.startTracer('Elevation chart rendered');
      this.drawChart_('speed', event.index, [0, 3]);
      goog.debug.Trace.startTracer('Elevation chart rendered');
      this.drawChart_('vario', event.index, [0, 4]);
      goog.debug.Trace.stopTracer(tracer);
      this.logger_.info(goog.debug.Trace.getFormattedTrace());
    },
    this
  );
};

/**
 * @param {string} type
 * @param {number} index
 * @param {Array.<number>} columns
 * @private
 */
vgps3.chart.Chart.prototype.drawChart_ = function(type, index, columns) {
  var view = this.chartData_[index].dataView,
      chart = this.charts_[type],
      container = this.chartContainers_[type],
      nbPoints = this.chartData_[index].fixes.nbChartPt,
      options = vgps3.chart.CHART_OPTIONS_[type];

  if (goog.isDef(options.hAxis.showTextEvery)) {
    options.hAxis.showTextEvery = Math.round(nbPoints / vgps3.chart.NB_HLABELS_);
  }

  if (goog.isDef(options.curve)) {
    options.curve = goog.style.getSize(container).width / nbPoints >  5 ? 'function' : 'none';
  }

  view.setColumns(columns);
  chart.draw(view, options);
};

/**
 * @param {number} index
 * @private
 */
vgps3.chart.Chart.prototype.createDataView_ = function(index) {
  var track = this.chartData_[index].fixes,
      dataTable = new google.visualization.DataTable();

  dataTable.addColumn('string', 'time');
  dataTable.addColumn('number', 'elev');
  dataTable.addColumn('number', 'elevGnd');
  dataTable.addColumn('number', 'Vx');
  dataTable.addColumn('number', 'Vz');

  for (var chartIndex = 0; chartIndex < track['nbChartPt']; chartIndex++) {
    dataTable.addRow([
      track['time']['hour'][chartIndex] + 'h' + track['time']['min'][chartIndex],
      track['elev'][chartIndex],
      track['elevGnd'][chartIndex],
      track['speed'][chartIndex],
      track['vario'][chartIndex]
    ]);
  }

  return new google.visualization.DataView(dataTable);
};


/**
 * @private
 */
vgps3.chart.Chart.prototype.apiLoadHandler_ = function() {
  var that = this;
  google.load('visualization', '1.0', {
    packages: ['corechart'],
    callback: goog.bind(this.chartLoaded_.callback, this.chartLoaded_)
  });
};


/**
 * @define {string}
 */
vgps3.chart.LOADER_URL = 'https://www.google.com/jsapi';


/**
 * @enum {string}
 */
vgps3.chart.EventType = {
  CLICK: 'vgps3.chart.click',
  MOVE: 'vgps3.chart.move',
  WHEEL: 'vgps3.chart.wheel',
  ABOUT: 'vgps3.chart.about'
};

/**
 * @type {number}
 * @const
 * @private
 */
vgps3.chart.NB_HLABELS_ = 6;

/**
 * @type {Object}
 * @const
 * @private
 */
vgps3.chart.CHART_OPTIONS_ = {
  elevation: {
    theme: 'maximized',
    fontName: 'verdana',
    fontSize: '10',
    lineWidth: 1,
    enableInteractivity: false,
    vAxis: {
      viewWindowMode: 'maximized',
      format: '# m'
    },
    hAxis: {
      showTextEvery: 160
    },
    series: {
      0: {
        color: '#ff0000',
        areaOpacity: 0
      },
      1: {
        color: '#755445',
        areaOpacity: 1
      }
    },
    legend: {
      position: 'none'
    }
  },
  speed: {
    curve: 'none',
    theme: 'maximized',
    fontName: 'verdana',
    fontSize: '10',
    lineWidth: 1,
    enableInteractivity: false,
    vAxis: {
      viewWindowMode: 'maximized',
      format: '# km/h'
    },
    hAxis: {
      showTextEvery: 160
    },
    series: [{
      color: 'green'
    }],
    legend: {
      position: 'none'
    }
  },
  vario: {
    curve: 'none',
    theme: 'maximized',
    fontName: 'verdana',
    fontSize: '10',
    lineWidth: 1,
    enableInteractivity: false,
    vAxis: {
      viewWindowMode: 'maximized',
      format: '#.# m/s'
    },
    hAxis: {
      showTextEvery: 160
    },
    series: [{
      color: 'blue'
    }],
    legend: {
      position: 'none'
    }
  }
};

goog.exportSymbol('vgps3.chart.Chart', vgps3.chart.Chart);
goog.exportSymbol('vgps3.chart.Chart.init', vgps3.chart.Chart.prototype.init);

