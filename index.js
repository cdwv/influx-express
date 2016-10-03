/**
 * @Author: Grzegorz Daszuta
 * @Date:   2016-10-01T20:08:29+02:00
 * @Email:  grzegorz.daszuta@codewave.pl
 * @Last modified by:   Grzegorz Daszuta
 * @Last modified time: 2016-10-03T08:51:50+02:00
 */


var Influx = require('influx-udp');
var os = require('os');
var debug = require('debug')('przepisy:influx');
var util = require('util');

module.exports = function(config, express) {
    var influx = new Influx({ 
      host: config.influx.host,
      port: config.influx.port,
    });

    function wrapMethod(mod, modName, method, wrapper) {
        var original = mod[method];
        var wrapped = wrapper(original, method);
        mod[method] = wrapped;
    }

    function getRoutePath(requestPath, params, query) {
      var path = requestPath;

      query = query || [];

      Object.keys(params).forEach(function(k) {
          if(!params[k]) return;

          debug('replace', params[k], util.format(':%s', k));
          path = path.replace(params[k], util.format(':%s', k));
      }.bind(this));

      if (query.length) {
        path = util.format('%s?%s', path, query.join('&'));
      }
      
      debug('path from %s to %s', requestPath, path);

      return path;
    }

    wrapMethod(express.response,
        'express.response',
        'end',
        wrapEnd.bind(null, 4));

    wrapMethod(express.Router,
        'express.Router',
        'process_params',
        wrapProcessParams.bind(null, 4));


    function wrapEnd(version, end) {
        return function() {
            end.apply(this, arguments);
            if(!this.__influxReporter) {
              debug("Request wasn't prepared");
              return;
            }

             if(this.__influxReporter.sent) {
              debug("Log data already sent");
              return;
            }
 
            var report = {
                [config.influx.dbpath]: [{
                    "app": config.appName,
                    "env": process.env.NODE_ENV,
                    "host": os.hostname(),
                    "instance": process.env.NODE_APP_INSTANCE,
                    "method": this.__influxReporter.method,
                    "url": this.__influxReporter.url,
                    "path": getRoutePath(this.__influxReporter.path, this.__influxReporter.params, this.__influxReporter.query),
                    "duration": new Date() - this.__influxReporter.startTime,
                }]
            };
            
            this.__influxReporter.sent = true;

            debug(report);
            influx.send(report);
        };
    }

    function wrapProcessParams(version, original) {
        return function(layer, called, req, res, done) {
            original.apply(this, arguments);

            res.__influxReporter = res.__influxReporter || {
                startTime: Date.now(),
                path: layer.path || req.path,
                method: req.method,
                url: req.url,
                params: {},
                query: [],
                names: [],
            };

            debug('process_params path "%s" layer path "%s" url "%s"', req.path, layer.path, req.url);
          

            res.__influxReporter.path = res.__influxReporter.path || (layer.route && layer.route.path ? layer.route.path : undefined);
            if (layer.params) Object.keys(layer.params).forEach(function(k) {
                res.__influxReporter.params[k] = layer.params[k];
            });
            if (req.query) Object.keys(req.query).forEach(function(p) {
                if (res.__influxReporter.query.indexOf(p) === -1) res.__influxReporter.query.push(p);
            });
        };
    }

    function wrapMiddlewareStack(route, original) {
        return function() {
            original.apply(this, arguments);
        };
    }
};
