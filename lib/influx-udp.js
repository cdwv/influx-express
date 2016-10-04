/**
 * @Author: Grzegorz Daszuta
 * @Date:   2016-10-03T10:16:00+02:00
 * @Email:  grzegorz.daszuta@codewave.pl
 * @Last modified by:   Grzegorz Daszuta
 * @Last modified time: 2016-10-03T16:42:43+02:00
 *
 * Partialy based on git://github.com/mediocre/node-influx-udp.git
 *
 */

/* jshint node: true */
'use strict';

var dgram = require('dgram');
var util = require('util');
var debug = require('debug')(['influx-express', 'send-udp'].join(':'));

var InfluxUdp = function influxUdp(opts) {
    opts = opts || {};
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 4444;
    this.socket = dgram.createSocket('udp4');
    this.servingSize = opts.servingSize || 32;
    this.interval = opts.interval || 1 * 1000;
    this.sender = setInterval(this.send.bind(this), this.interval);
    this.results = [];
};

function escapeValue(v) {
    if(!v) {
        return v;
    }

    if (/^\d+(\.\d+)?$/.test(v)) {
        return v;
    }

    if (typeof v === 'string') {
        return util.format('"%s"', v.replace(/"/g, '\\"'));
    }
}

function escapeTag(v) {
    return v.replace(' ', '_');
}

InfluxUdp.prototype.queue = function influxQueue(points) {
    var i = 0;
    Object.keys(points).forEach(function() {
        for (var name in points) {
            points[name].forEach(function(series) {
                var tags = Object.keys(series.tags).map(function(v) {
                    return util.format("%s=%s", v, escapeTag(series.tags[v]));
                }).join(',');

                var values = Object.keys(series.values).map(function(v) {
                    return util.format("%s=%s", v, escapeValue(series.values[v]));
                }).join(',');

                this.results.push(util.format("%s,%s %s", name, tags, values));
                i += 1;
            }.bind(this));
        }

    }.bind(this));

    debug("Put %s messages into queue", i);
};

InfluxUdp.prototype.send = function influxSend()
{
    debug("Queue size: %s messages", this.results.length);

    var serving = this.results.splice(0, this.servingSize);

    if(serving.length === 0) {
      return;
    }

    if(!this.socket) {
      debug("Socket not ready");
      return;
    }

    debug("sending %s messages", serving.length);
    var message = new Buffer(serving.join("\n"));
    this.socket.send(message, 0, message.length, this.port, this.host);
}


module.exports = InfluxUdp;
