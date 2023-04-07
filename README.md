# reporter.js
Website monitoring

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
    url: 'https://example.com/errors', // reporting-url
    max: 50, // max reportings to send
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
