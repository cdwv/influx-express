/**
 * @Author: Grzegorz Daszuta
 * @Date:   2016-10-01T20:08:29+02:00
 * @Email:  grzegorz.daszuta@codewave.pl
 * @Last modified by:   Grzegorz Daszuta
 * @Last modified time: 2016-10-03T16:43:05+02:00
 */

/* jshint node: true */
/* jshint esversion: 6 */
'use strict';

var Influx = require('./lib/influx-udp');
var os = require('os');
var debug = require('debug')(['influx-express', 'main'].join(':'));
var util = require('util');

var onFinished = require('on-finished');
var onHeaders = require('on-headers');

module.exports = function(config, express) {
    var influx = new Influx({
        host: config.influx.host,
        port: config.influx.port,
    });

    function recordStartTime() {
        this._influx.startAt = process.hrtime();
        this._influx.startTime = new Date();
    }

    function getResponseTime(req, res, digits) {
        if (!req._influx.startAt || !res._influx.startAt) {
            // missing request and/or response start time
            return;
        }

        var ms = (res._influx.startAt[0] - req._influx.startAt[0]) * 1e3 +
            (res._influx.startAt[1] - req._influx.startAt[1]) * 1e-6

        return ms.toFixed(digits === undefined ? 3 : digits)
    }

    function getRoute(req) {
        var route;
        if (req.route) {
            route = req.route.path;
        }
        if (!req.route) {
            route = req.baseUrl;

            if (req.params) {
                Object.keys(req.params).forEach(function(k) {
                    route = route.replace(req.params[k], util.format(':%s', k));
                });
            }
        }
        if (req.query && Object.keys(req.query).length > 0) {
            route += '?' + Object.keys(req.query).join('&');
        }
        return route;
    }

    return function influxLogger(req, res, next) {
        req._influx = {
            startAt: undefined,
            startTime: undefined,
        };

        res._influx = {
            startAt: undefined,
            startTime: undefined,
        };

        recordStartTime.call(req);

        function logRequest() {
            debug(req._influx, res._influx);
            if (req.rendrApp) debug(req.rendrApp.req.route);
            if (req._influx_sent) {
                debug('Already logged');
                return;
            }

            var report = {
                [config.influx.dbpath]: [{
                    tags: {
                        "app": config.appName,
                        "env": process.env.NODE_ENV,
                        "host": os.hostname(),
                        "instance": process.env.NODE_APP_INSTANCE,
                        "method": req.method,
                        "route": getRoute(req),
                    },
                    values: {
                        "duration": getResponseTime(req, res),
                        "url": req.url,
                    }
                }]
            };

            req._influx.sent = true;

            debug(report);
            influx.send(report);

        }

        // record response start
        onHeaders(res, recordStartTime);

        // log when response finished
        onFinished(res, logRequest);

        next();
    };
};
