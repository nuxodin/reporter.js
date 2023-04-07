// options:
// globalThis.reporterJsOptions = {
//     url: 'https://example.com/reporter.php',
//     max: 50,
//     showFirst: true, // browser only
//     console: ['error','warn','debug'], // needs to be set before init
// }

globalThis.reporterJs = {
    init() {
        Error.stackTraceLimit = Math.max(Error.stackTraceLimit, 30);
        // let unloading = false;
        // addEventListener('beforeunload',function(e){ unloading = e.type; });
        // addEventListener('unload',function(e){ unloading = e.type; });
        addEventListener('error', this.handleErrorEvent.bind(this), true);
        addEventListener('unhandledrejection', this.handleUnhandledRejectionEvent.bind(this), true);
        if (window.ReportingObserver) {
            const observer = new ReportingObserver(this.handleReportingObserver.bind(this), {buffered: true});
            observer.observe();
        }
        this.wrapConsole('error');
        this.wrapConsole('warn');
        this.wrapConsole('debug');
    },
    counter: 0,
    async send(data) {

        const {url, max=50, showFirst} = globalThis.reporterJsOptions;

        if (!url || this.counter++ > max) return;

        data.referer = window.document?.referrer;
        data.request = window.location?.href;

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
            console.log('%c Failed to send error report:' + e.message, 'color:red');
        });
        if (showFirst && this.counter < 2) this.showError(data);
    },

    showError(data){
        if (document.body) {
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed; top:0; left:0; right:0; background:rgba(255,40,0,.7); color:#fff; padding:20px; font-size:17px; z-index:1000; text-align:center';
            div.innerHTML = `${data.message}<br>${data.file} :${data.line} :${data.col}`;
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
        if (e.bubbles) { // its a real error
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
        const original = console[method];
        console[method] = (...args)=>{
            const stack = this.unserializeStack(new Error().stack);
            stack.shift();
            const latest = stack[0] || {};
            this.send({
                message:   '(console.'+method+') '+args.join(' | '),
                function:  latest.function,
                file:      latest.file,
                line:      latest.line,
                col:       latest.col,
                backtrace: stack,
                prio:      method === 'error' ? 'error' : 'warning',
            });
            original.call(console, latest.file+':'+latest.line+':'+latest.col);
            return original.apply(console, args);
        }
    },
};

globalThis.reporterJsOptions = globalThis.reporterJsOptions || {};

reporterJs.init();

// if (window.PerformanceObserver) {
// 	const mainDuration = performance.timing.responseEnd - performance.timing.requestStart;
// 	const faktor = mainDuration / 300; // reference is 200ms
// 	faktor = Math.max(faktor, 1);
// 	const observer = new PerformanceObserver(function(list) {
// 		list.getEntries().forEach(function(entry){
// 			if (entry.entryType === 'paint' && entry.duration < 10) return;
// 			if (entry.entryType === 'resource' && entry.duration < 8000*faktor) return;
// 			if (entry.entryType === 'navigation' && entry.duration < 8000*faktor) return;
// 			if (entry.entryType === 'frame' && entry.duration < 8000*faktor) return;
// 			const data = {
// 				message:'(performance observer) v2 entryType:'+entry.entryType+' initiatorType:'+entry.initiatorType+' duration:'+entry.duration+' transferSize:'+entry.transferSize+' name:'+entry.name, //+'  |  obj:'+JSON.stringify(entry),
// 				source:'perf',
// 				prio:'notice',
// 			}
// 			if (entry.entryType === 'resource' || entry.entryType === 'navigation') {
// 				data.file = entry.name;
// 			}
// 			send(data);
// 		});
// 	});
// 	observer.observe({entryTypes: ['navigation','resource','mark','measure','paint']}); // longtask, frame
// }
