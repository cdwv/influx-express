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
};

function escapeValue(v) {
    if (/[\d.]/.test(v)) {
        return v;
    }

    return util.format('"%s"', v);
}

function escapeTag(v) {
    return v.replace(' ', '_');
}

InfluxUdp.prototype.send = function influxSend(points) {
    var results = [];

    Object.keys(points).forEach(function() {
        for (var name in points) {
            points[name].forEach(function(series) {
                console.log(series);
                var tags = Object.keys(series.tags).map(function(v) {
                    return util.format("%s=%s", v, escapeTag(series.tags[v]));
                }).join(',');

                var values = Object.keys(series.values).map(function(v) {
                    return util.format("%s=%s", v, escapeValue(series.values[v]));
                }).join(',');

                results.push(util.format("%s,%s %s", name, tags, values));
            });
        }

    });

    debug(results);

    var message = new Buffer(results.join("\n"));
    this.socket.send(message, 0, message.length, this.port, this.host);
};

module.exports = InfluxUdp;
