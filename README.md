# Usage

```
const express = require('express');
const InfluxReporter = require('influx-reporter');

InfluxReporter({
  appName: 'my app name',
  influx: {
    host: "my.influx.host.domain",
    port: 4444,
    dbpath: "path.in.database"
  }
}, express); 
```

At the moment reporter uses only UDP.

# TODO

- Configurable report parameters;
- Creating flags;
- TCP support;
- Better instrumentation
