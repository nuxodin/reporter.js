# reporter.js
Application monitoring / Troubleshooting

Reporter.js is a small JavaScript library for monitoring websites and Deno applications. It sends reports for JavaScript errors, unhandled rejections, console calls, and ReportingObserver reports to your server.

## Features

- JavaScript errors
- unhandled rejections
- console calls (`error`, `warn`, `debug` by default)
- ReportingObserver reports, if supported by the runtime

## Install

### In your website

```html
<script>
// Load reporter.js as early as possible.
window.reporterJsOptions = {
    url: 'https://example.com/errors',
    max: 50,
}
</script>
<script src="https://cdn.jsdelivr.net/gh/nuxodin/reporter.js/mod.js"></script>
```

### In Deno

```js
globalThis.reporterJsOptions = {
    url: 'https://example.com/reporter.php',
    max: 50,
}
await import('https://cdn.jsdelivr.net/gh/nuxodin/reporter.js/mod.js');
```

## Options

Set `globalThis.reporterJsOptions` before loading `mod.js`.

```js
globalThis.reporterJsOptions = {
    url: 'https://example.com/errors',
    max: 50,
    showFirst: true,
    console: ['error', 'warn', 'debug'],
    onError(data) {
        console.log(data);
    },
}
```

## Usage

```js
console.warn('test') // will be sent to the server
```

To disable console reporting:

```js
globalThis.reporterJsOptions = {
    url: 'https://example.com/errors',
    console: false,
}
```

To only report selected console methods:

```js
globalThis.reporterJsOptions = {
    url: 'https://example.com/errors',
    console: ['error', 'warn'],
}
```

## Server endpoint

Reporter.js sends reports with `POST` and `Content-Type: application/json`.

Example payload:

```json
{
    "message": "Unhandled rejection in Promise: failed",
    "file": "https://example.com/app.js",
    "line": 12,
    "col": 5,
    "backtrace": [],
    "prio": "error",
    "referer": "https://example.com/",
    "request": "https://example.com/page"
}
```
