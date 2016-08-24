var fs = require('fs');
var system = require('system');
var webpage = require('webpage');

// This will eventually get filled out with additional providers as needed,
// and let's hope they aren't more complicated than MBO.
var PROVIDER_INFO = 
{
  "MBO": 
  {
    urlPattern: 'https://clients.mindbodyonline.com/classic/home?studioid=',
    forcePage: 'https://clients.mindbodyonline.com/classic/mainclass?fl=true&tabID=7',
    tableResourcePattern: /^https:\/\/clients.mindbodyonline.com\/classic\/mainclass/,
    tableCssClass: '.classSchedule-mainTable-loaded',
  }
};

function dumpClassTable(providerInfo, studioId)
{
  const URL = providerInfo.urlPattern + studioId;

  var studiopage = webpage.create();
  var tablepage = webpage.create();

  var needsTableResource = (providerInfo.tableResourcePattern !== null);
  var tableresource = null;
  var redirected = false;

  tablepage.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.trace(msg);
  }

  /* For additional debugging
  studiopage.onLoadStarted = function() {
    console.trace('= onLoadStarted()');
    var currentUrl = studiopage.evaluate(function() {
      return window.location.href;
    });
    console.trace('  leaving url: ' + currentUrl);
  };

  studiopage.onNavigationRequested = function(url, type, willNavigate, main) {
    console.trace('= onNavigationRequested');
    console.trace('  destination_url: ' + url);
    console.trace('  type (cause): ' + type);
    console.trace('  will navigate: ' + willNavigate);
    console.trace('  from webpage\'s main frame: ' + main);
  };

  studiopage.onResourceRequested = function (request) {
    console.trace('= onResourceRequested()');
    console.trace('  request: ' + JSON.stringify(request, undefined, 4));
  };

  */

  tablepage.onLoadFinished = function(status) {
    if (status === 'success')
    {
      console.trace('Successful load of table resource, getting table from page');
      // The execution of "evaluate" is sandboxed, so there's no accessing *anything*
      // outside, so we have to pass it in.
      var tableElement = tablepage.evaluate(function(tableCssClass) {
        return document.querySelector(tableCssClass);
      }, providerInfo.tableCssClass);
      var path = studioId + '.html';
      fs.write(path, tableElement.outerHTML, function(error) {
        if (error) {
          console.error("Error writing:  " + error.message);
        } else {
          console.log("Success writing to " + path);
        }
      });
      tablepage.close();
      phantom.exit();
    }
    else
    {
      console.trace('Error loading table resource');
    }
  }

  studiopage.onResourceReceived = function(response) {
    if (needsTableResource &&
        response.stage === "end" &&
        response.url.match(providerInfo.tableResourcePattern))
    {
      /* additional debugging
      console.trace('= onResourceReceived()' );
      console.trace('  id: ' + response.id + ', stage: "' + response.stage + '", url: ' + response.url);
      */
      console.trace('Will get table resource: ' + response.url);
      tableresource = response.url;
    }
  };

  studiopage.onLoadFinished = function(status) {
    /* For additonal debugging
    console.trace('= onLoadFinished()');
    console.trace('  status: ' + status);
    var currentUrl = studiopage.evaluate(function() {
      return window.location.href;
    });
    console.trace('  url: ' + currentUrl);
    */
    if (status === 'success')
    {
      if (needsTableResource)
      {
        if (redirected === false)
        {
          if (tableresource === null)
          {
            console.trace('Table resource not found, forcing redirect to correct page');
            studiopage.open(providerInfo.forcePage);
          }
          else
          {
            console.trace('Successful load, now requesting table resource');
            redirected = true;
            tablepage.open(tableresource);
            studiopage.close();
          }
        }
      }
      else
      {
        console.trace('Successful load of page, getting table');
        var tableElement = studiopage.evaluate(function(tableCssClass) {
          return document.querySelector(tableCssClass);
        }, providerInfo.tableCssClass);
        var path = studioId + '.html';
        fs.write(path, tableElement.outerHTML, function(error) {
          if (error) {
            console.error("Error writing:  " + error.message);
          } else {
            console.log("Success writing to " + path);
          }
        });
        studiopage.close();
        phantom.exit();
      }
    }
    else
    {
      console.error('Error loading studio page');
      //phantom.exit();
    }
  };

  studiopage.onResourceError = function(resourceError) {
    console.trace('= onResourceError()');
    console.trace('  - unable to load url: "' + resourceError.url + '"');
    console.trace('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
  };

  studiopage.onError = function(msg, trace) {
    console.error('= onError()');
    var msgStack = ['  ERROR: ' + msg];
    if (trace) {
      msgStack.push('  TRACE:');
      trace.forEach(function(t) {
        msgStack.push('    -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
      });
    }
    console.error(msgStack.join('\n'));
  };

  studiopage.open(URL);
}

if (system.args.length > 1)
{
  dumpClassTable(PROVIDER_INFO[system.args[1]], system.args[2]);
}
else
{
  console.log('Not enough args provided: ' + system.args);
  phantom.exit();
}