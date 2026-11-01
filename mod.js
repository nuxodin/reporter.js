// options:
// globalThis.reporterJsOptions = {
//     url: 'https://example.com/reporter.php',
//     max: 50,
//     showFirst: true, // browser only
//     console: ['error','warn','debug'], // needs to be set before init
// }

globalThis.reporterJs = {
    init() {
        if (this.initialized) return;
        this.initialized = true;

        Error.stackTraceLimit = Math.max(Error.stackTraceLimit, 30);
        // let unloading = false;
        // addEventListener('beforeunload',function(e){ unloading = e.type; });
        // addEventListener('unload',function(e){ unloading = e.type; });
        if (globalThis.process?.on && !globalThis.Deno) { // Node and Bun: no such events
            // a monitor only listens, the process still crashes
            process.on('uncaughtExceptionMonitor', this.handleUncaught.bind(this));
            // Bun skips the monitor for rejections: rethrown they reach it and crash as usual
            if (globalThis.Bun) process.on('unhandledRejection', reason => { throw reason; });
        } else {
            addEventListener('error', this.handleErrorEvent.bind(this), true);
            addEventListener('unhandledrejection', this.handleUnhandledRejectionEvent.bind(this), true);
        }
        if (globalThis.ReportingObserver) {
            const observer = new ReportingObserver(this.handleReportingObserver.bind(this), {buffered: true});
            observer.observe();
        }
        const consoleMethods = globalThis.reporterJsOptions.console ?? ['error', 'warn', 'debug'];
        if (consoleMethods) consoleMethods.forEach(method => this.wrapConsole(method));
    },
    counter: 0,
    async send(data) {

        const {url, max=50, showFirst, onError} = globalThis.reporterJsOptions;

        if (this.counter++ > max) return;

        data.referer = globalThis.document?.referrer;
        data.request = globalThis.location?.href;

        if (onError) await onError(data);
        if (url) {
            // if (data.file && data.file === data.request) {
            //     const lines = document.documentElement.outerHTML.split('\n');
            //     const i = data.line - 3;
            //     const line = lines[i];
            //     if (line) {
            //         lines[i] = line.slice(0, data.col - 1) + '❌' + line.slice(data.col - 1);
            //     }
            //     data.sample = lines.join('\n');
            // }
            // if (!data.file || data.file.indexOf('://' + location.host) < 0) data.prio = 'notice';
            await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify(data),
            }).catch(e => {
                (this.originalConsole?.warn || console.warn).call(console, '%c Failed to send error report:' + e.message, 'color:red');
            });
        }
        if (showFirst && this.counter < 2) this.showError(data);
    },

    showError(data){
        if (document.body) {
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed; top:0; left:0; right:0; background:rgba(255,40,0,.7); color:#fff; padding:20px; font-size:17px; z-index:1000; text-align:center';
            div.append(data.message, document.createElement('br'), `${data.file} :${data.line} :${data.col}`);
            document.body.append(div);
            const to = setTimeout(() => div.remove(), 2000);
            div.addEventListener('mouseenter', () => clearTimeout(to) );
            div.addEventListener('mouseleave', () => div.remove() );
            div.addEventListener('click', () => div.remove() );
        } else {
            alert(data.message);
        }
    },
    unserializeStack(stackString){
        const stack = [];
        if (!stackString) return stack;
        const parts = stackString.split('\n');
        for (const lineStr of parts) {
            let x = lineStr.match(/(.*)[(@ ]([^@]*):([0-9]+):([0-9]+)/);
            if (!stack.length && !x) continue; // first lines chrome
            if (!x) x = [];
            const [fn='', file='', line='', col=''] = x.slice(1);
            const data = {
                raw:      lineStr,
                function: fn.trim().replace(/^at( |$)/,''),
                file,
                line,
                col,
            };
            stack.push(data);
        }
        return stack;
    },
    handleErrorEvent(e){
        if (e.bubbles || e.error) { // its a real error (Deno: not bubbling)
            const error = e.error;
            const stack = error && error.stack ? this.unserializeStack(error.stack) : [];
            this.send({
                message: e.message,
                file: e.filename,
                line: e.lineno,
                col:  e.colno,
                backtrace: stack,
                prio: 'error',
            });
        } else { // its a load error
            // if (unloading) return;
            // const el = e.target;
            // const sample = (el.parentNode.parentNode || el.parentNode).innerHTML.replace(el.outerHTML, '❌'+el.outerHTML);
            // const src = el.src || el.href;
            // send({
            //     source: 'net',
            //     message: 'client failed to load: '+src,
            //     file: src,
            //     sample: sample,
            //     backtrace:[],
            //     prio: 'notice',
            // });
        }
    },
    handleUnhandledRejectionEvent(e){
        const message = e.reason ? e.reason.message : '(no e.reason, edge?)';
        const stack   = e.reason ? this.unserializeStack(e.reason.stack) : [];
        if (!stack[0]) stack[0] = {};
        this.send({
            message: 'Unhandled rejection in Promise: '+message+(!stack.length?' (no stack)':''),
            file: stack[0].file,
            line: stack[0].line,
            col:  stack[0].col,
            backtrace: stack,
            prio: 'error',
        });
    },
    handleUncaught(error, origin){
        if (origin === 'unhandledRejection') return this.handleUnhandledRejectionEvent({reason: error});
        const [top = {}] = this.unserializeStack(error?.stack);
        this.handleErrorEvent({
            bubbles: true,
            error,
            message: String(error?.message ?? error),
            filename: top.file,
            lineno: top.line,
            colno: top.col,
        });
    },
    handleReportingObserver(reports){
        for (const report of reports) {
            const body = report.body;
            if (!body.message && !body.id && !body.reason) continue; // chromium bug, no infos
            let prio = 'notice';
            if (report.type==='deprecation') prio = 'warning';
            this.send({
                message: `(ReportingObserver) type:${report.type} | id:${body.id} | message:${body.message} | body.reason:${body.reason} | anticipatedRemoval:${body.anticipatedRemoval}`,
                file:     body.sourceFile,
                line:     body.lineNumber,
                col:      body.columnNumber,
                prio,
                backtrace: [],
            });
        }
    },
    wrapConsole(method){
        this.originalConsole = this.originalConsole || {};
        const original = console[method];
        this.originalConsole[method] = original;
        console[method] = (...args)=>{
            const errArg = args.find(a => a instanceof Error);
            let stack, latest;
            if (errArg?.stack) {
                stack  = this.unserializeStack(errArg.stack);
                latest = stack[0] || {};
            } else {
                stack  = this.unserializeStack(new Error().stack);
                stack.shift();
                latest = stack[0] || {};
            }
            this.send({
                message:   '(console.'+method+') '+args.join(' | '),
                function:  latest.function,
                file:      latest.file,
                line:      latest.line,
                col:       latest.col,
                backtrace: stack,
                prio:      method === 'error' ? 'error' : 'warning',
            });
            if (globalThis.Deno) console.log('%c↓ '+method+' '+latest.file+':'+latest.line+':'+latest.col, 'color:#00f; font-size:.8em');
            return original.apply(console, args);
        }
    },
};

globalThis.reporterJsOptions = globalThis.reporterJsOptions || {};

reporterJs.init();
