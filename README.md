# reporter.js
Website monitoring

Reporter.js is a JavaScript library for monitoring websites and Deno applications. It enables you to send notifications to a server for different types of events such as JS errors, unhandled rejections, console calls (error/warn/debug), and ReportingObserver. With reporter.js, you can track issues in your website or Deno application and resolve them quickly, improving your user experience.

## Features
Send different types of notifications to a server
- js errors
- unhandles rejections
- console calls (error/warn/debug)
- ReportingObserver

## Install

### In your website

```html
<script>
// as it should be loaded as fast as possible, it makes sens to load it not as a module    
window.reporterJsOptions = {
    // reporting-url
    url: 'https://example.com/errors',
    // max reportings to send
    max: 50, 
}
</script>
<script src="https://cdn.jsdelivr.net/gh/nuxodin/reporter.js/mod.js"></script>
```

### In deno

```js
window.reporterJsOptions = {
    url: 'https://example.com/reporter.php',
    max: 50,
}
import 'https://cdn.jsdelivr.net/gh/nuxodin/reporter.js/mod.js';
```

## Usage

```js
console.warn('test') // will be send to the server
```
