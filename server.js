var http = require('http');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');

var log = console.log.bind(console);

// Log given `req` request
var logRequest = function (req) {
  log(req.method + ' ' + req.url + ' accept: ' + req.headers.accept);
  // log('with headers: ');
  // log(req.headers);
};

// Buld padding of length `numOfBytes`
var buildPadding = function (numOfBytes) {
  return _.times(numOfBytes, function () { return ';'; }).join(''); // ';' Denotes a comment
};

//
var eventStreamConnectionId = 0;
var respondToEventStreamRequest = function (req, res) {
  ++eventStreamConnectionId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*' // IE9 barfs without an Allow-Origin header in the response
  });

  // Send 2KB of padding. This is necessary for IE9
  res.write(buildPadding(2000) + '\n\n');

  var eventInterval = setInterval((function (conId) {
    var eventId = 0;
    return function () {
      ++eventId;

      log('event stream ' + conId + ': sending tick ' + eventId);

      res.write('id:' + eventId + '\n');
      res.write('event:tick\n');
      res.write('data:' + JSON.stringify({ whatever: true }) + '\n\n');
    };
  }(eventStreamConnectionId)), 3000);


  req.on('close', (function (conId) {
    return function () {
      log('Connection closed for event stream ' + conId + '. Will stop sending events');
      clearInterval(eventInterval);
    };
  }(eventStreamConnectionId)));
};

var respondToStaticAssetRequest = function (req, res) {

  // This is supposed to remove the initial '/' and default to 'index.html'
  var pathToRequestedAsset = req.url.slice(1).trim() || 'index.html';
  pathToRequestedAsset = path.join(__dirname, pathToRequestedAsset);

  // Figure out the content type
  var contentType = (function (requestedAssetExtension) {
    switch (requestedAssetExtension) {
      case 'html': return 'text/html';
      case 'js': return 'text/javascript';
    }
  }(pathToRequestedAsset.slice(pathToRequestedAsset.lastIndexOf('.') + 1)));

  fs.readFile(pathToRequestedAsset, function (error, data) {

    if (error) {
      log('Error reading file: ' + pathToRequestedAsset);
      log(error);
      return;
    }

    log('Responding with static asset ' + pathToRequestedAsset);

    res.writeHead(200, { 'Content-Type': contentType });
    res.write(data);
    res.end();
  });
};

http.createServer(function (req, res) {

  // The initial implementation for picking between a static asset response or an event stream
  //  response relied on looking at the accept header content: Any request with an accept header
  //  that included 'text/event-stream' was handled as a request for the event stream. Any other
  //  request was handled as a request for a static asset. However, this does not work for IE9 as
  //  the requests come in with an accept header of '*/*'. Thus, we now look at the req.url and
  //  only if it starts with '/event-stream' do we respond with events:

  log('received request:');
  logRequest(req);

  // So instead of
  //  if (req.headers.accept && req.headers.accept.indexOf('text/event-stream') !== -1) {
  //  we now have:
  if (req.url.indexOf('/event-stream') === 0) {
    log('Attempting event stream response');
    respondToEventStreamRequest(req, res);
    return;
  } else {
    log('Attempting static asset response');
    respondToStaticAssetRequest(req, res);
    return;
  }

}).listen(3333);

log('Listening on port 3333');
