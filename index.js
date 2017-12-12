const CDP = require('chrome-remote-interface');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const net = require('net');
const commandExists = require('command-exists');
//const Jimp = require('jimp')
//const { createCanvas, Image } = require('canvas-prebuilt')
const Canvas = require('canvas-prebuilt')
var stream = require('stream');
					
class RenderPDF {
    constructor(options) {
        this.setOptions(options || {});
        this.chrome = null;
        this.port = Math.floor(Math.random() * 10000 + 1000);
    }

    setOptions(options) {
        this.options = {
            printLogs: def('printLogs', false),
            printErrors: def('printErrors', true),
            chromeBinary: def('chromeBinary', null),
            noMargins: def('noMargins', false),
            landscape: def('landscape', undefined),
            paperWidth: def('paperWidth', undefined),
            paperHeight: def('paperHeight', undefined),
            includeBackground: def('includeBackground', undefined),
            captureFormat: def('captureFormat', undefined),
            captureQuality: def('captureQuality', undefined),
            dpi: def('dpi', undefined),
            captureStepHeight: def('captureStepHeight', undefined),
            saveFormat: def('saveFormat', undefined),
            saveQuality: def('saveQuality', undefined),
            clip: def('clip', undefined),
            fromSurface: def('fromSurface', undefined),
            timeout: def('timeout', undefined),
            fullHeight: def('fullHeight', undefined),
        }; 
		
        this.commandLineOptions = {
            windowSize: def('windowSize', undefined),
            extraOptions: def('extraCliOptions', undefined)
        };

        function def(key, defaultValue) {
            return options[key] === undefined ? defaultValue : options[key];
        }
    }

    static async generateSinglePdf(url, filename, options) {
        const renderer = new RenderPDF(options);
        await renderer.spawnChrome();
        await renderer.waitForDebugPort();
        try {
            const buff = await renderer.renderPdf(url, renderer.generatePdfOptions());
            fs.writeFileSync(filename, buff);
            renderer.log(`Saved ${filename}`);
        } catch (e) {
            renderer.error('error:', e);
        }
        renderer.killChrome();
    }

    static async generatePdfBuffer(url, options) {
        const renderer = new RenderPDF(options);
        await renderer.spawnChrome();
        await renderer.waitForDebugPort();
        try {
            return renderer.renderPdf(url, renderer.generatePdfOptions());
        } catch (e) {
            renderer.error('error:', e);
        } finally {
            renderer.killChrome();
        }
    }

    static async generateMultiplePdf(pairs, options) {
        const renderer = new RenderPDF(options);
        await renderer.spawnChrome();
        await renderer.waitForDebugPort();
        for (const job of pairs) {
            try {
                const buff = await renderer.renderPdf(job.url, renderer.generatePdfOptions());
                fs.writeFileSync(job.pdf, buff);
                renderer.log(`Saved ${job.pdf}`);
            } catch (e) {
                renderer.error('error:', e);
            }
        }
        renderer.killChrome();
    }

    async renderPdf(url, options) {
        return new Promise((resolve) => {
            CDP({port: this.port}, async (client) => {
                this.log(`Opening `+ url.substr(0,150)+(url.length>150?'...':'') );
                const {Page, Emulation, Animation} = client;
                await Page.enable();
                //await Animation.enable();

                await Page.navigate({url});
                await Emulation.setVirtualTimePolicy({policy: 'pauseIfNetworkFetchesPending', budget: options.timeout||5000});

                const loaded = this.cbToPromise(Page.loadEventFired);
                const jsDone = this.cbToPromise(Emulation.virtualTimeBudgetExpired);

                await this.profileScope('Wait for load', async () => {
                    await loaded;
                });

                await this.profileScope('Wait for js execution', async () => {
                    await jsDone;
                });

                const pdf = await Page.printToPDF(options);
                const buff = Buffer.from(pdf.data, 'base64');
                client.close();
                resolve(buff);
            });
        });
    }
	
	delay(ms) {
		return new Promise((resolve)=> {
			setTimeout(resolve, ms);
		});
	}
	
    async renderCapture(url, options, script) {
        return new Promise((resolve) => {
            CDP({port: this.port}, async (client) => {
				this.log(`Opening `+ url.substr(0,150)+(url.length>150?'...':'') );
                const {Page, Emulation, Animation, Runtime /*, HeadlessExperimental*/} = client;
                await Page.enable();
                await Animation.enable();
				//await HeadlessExperimental.enable() 
                await Page.navigate({url});
				await Emulation.setVirtualTimePolicy({policy: 'pauseIfNetworkFetchesPending', budget: options.timeout||5000}); 
                const loaded = this.cbToPromise(Page.loadEventFired);
                const jsDone = this.cbToPromise(Emulation.virtualTimeBudgetExpired);
                //const shotDone = this.cbToPromise(HeadlessExperimental.mainFrameReadyForScreenshots); 
				
				if(script) 
					await this.profileScope('Running script', async () => {
						await Runtime.evaluate({expression:script})
					});	
					
                if(url!=='about:blank')
					await this.profileScope('Wait for load', async () => {
						await loaded;
					});
					
                await this.profileScope('Wait for js execution', async () => {
                    await jsDone;
                });
				//await Runtime.evaluate({expression:'window.scrollTo(\'0px\', \'600px\');'})
				//this.log('Openin 8')
				//await this.delay(4000)
                //await this.profileScope('Wait for shot Done', async () => {
                //    await shotDone;
                //}); 
                //const png = await HeadlessExperimental.beginFrame({format:'png'});
				
				let tile_height=this.commandLineOptions.windowSize[1];
				//let tiles=[];
				let height_captured = 0
				
				var maxheight=options.clip.height;
				var saveFormat=options.saveFormat||'png';
				var saveQuality=options.saveQuality||98; // 98 is max quality that has some compression
				var dpi=options.dpi||96; // modern  (not high end) dispalys are at 96 dpi, and dpi of css pixel is also 96
				var dpiwidth=Math.round(options.clip.width*(72/dpi));
				var dpiheight=Math.round(maxheight*(72/dpi));
				var captureStepHeight=options.captureStepHeight;
				
				var pageWidth  = options.paperWidth  ? Math.floor(options.paperWidth  * 72) : dpiwidth  ; // pdfs are always at 72 dpi
				var pageHeight = options.paperHeight ? Math.floor(options.paperHeight * 72) : dpiheight ;
				//this.log( options.paperWidth+" x "+options.paperHeight+' = ' + pageWidth+" x "+pageHeight  )
 
				const options2 = {};
				if(options.captureFormat !== undefined)    options2.format      = options.captureFormat;
				if(options.captureQuality !== undefined)   options2.quality     = options.captureQuality;
				if(options.fromSurface !== undefined)      options2.fromSurface = options.fromSurface;
				if(options.clip !== undefined)             options2.clip        = options.clip;
				
				//var pageimg = new Jimp(options.clip.width, maxheight);
				const canvas = new Canvas(options.clip.width,maxheight)
				const ctx = canvas.getContext('2d')
				
				let tile_y=0;
				await this.profileScope('full captureScreenshot', async () => {
					while (height_captured < maxheight ){
					  await this.profileScope('partial captureScreenshot', async () => {
						  options2.clip.height=(maxheight-height_captured>tile_height)?tile_height: (maxheight-height_captured)		
						  options2.clip.y=tile_y*tile_height;
						  
						  
						  await Runtime.evaluate({expression:'window.scrollTo(\'0px\', \''+options2.clip.y+'\');'})
						  const png  = await Page.captureScreenshot(options2); 

						  const buff = Buffer.from(png.data, 'base64');
						  
						  //tiles.push(buff);
						  
						  //let img = await Jimp.read(buff);
						  let img = new Canvas.Image();
						  img.src=buff;
						  //pageimg.blit( img, 0, height_captured );
						  ctx.drawImage(img, 0, height_captured);

						  height_captured += tile_height
						  tile_y++;
					  });
					}
				});
                client.close();
				//pageimg.quality( 100 ); 
				//pageimg.getBuffer(Jimp.MIME_PNG,(err,buf2)=>resolve(buf2) );
				await this.profileScope('making save format', ()=>{ 
					return (new Promise((resolve)=>{
						if(options.saveFormat==='png'||options.saveFormat==='pngpdf'||options.saveFormat===undefined)
						{						
							canvas.toBuffer((err, buf2)=>{
								resolve( buf2 );
							}); // CanvasPNG Buffer
						}
						else if(options.saveFormat==='jpeg'||options.saveFormat==='jpegpdf')
						{
							let chunks = []; // We'll store all the data inside this array
							const stream = canvas.jpegStream({
								bufsize: 4096 // output buffer size in bytes, default: 4096
							  , quality: saveQuality // JPEG quality (0-100) default: 75
							  , progressive: false // true for progressive compression, default: false
							});
							stream.on('data', function(chunk){
							  chunks.push(chunk);
							});
							stream.on('end', function(){
							  const buf2 = Buffer.concat(chunks);
							  resolve( buf2 );
							});
						}
						else 
							throw new Error('incorrect saveFormat specified')
					})).then( (buf2)=> {
							if(options.saveFormat==='pngpdf'||options.saveFormat==='jpegpdf')
							{
								const canvas = new Canvas( pageWidth , pageHeight,'pdf')	
								const ctx = canvas.getContext('2d')
								const img = new Canvas.Image();
								img.src=buf2;
								//pageimg.blit( img, 0, 0 );
								ctx.drawImage(img, 0, 0 ,dpiwidth,dpiheight);
								const buf3 = canvas.toBuffer(); 
								resolve( buf3 );
							}
							else
								resolve( buf2 );
					})
				});
				
					
				
				
            });
        });
    }
	
    generatePdfOptions() {
        const options = {};
        if (this.options.landscape !== undefined) {
            options.landscape = !!this.options.landscape;
        }

        if (this.options.noMargins) {
            options.marginTop = 0;
            options.marginBottom = 0;
            options.marginLeft = 0;
            options.marginRight = 0;
        }

        if (this.options.includeBackground !== undefined) {
            options.printBackground = !!this.options.includeBackground;
        }

        if(this.options.paperWidth !== undefined) {
            options.paperWidth = parseFloat(this.options.paperWidth);
        }

        if(this.options.paperHeight !== undefined) {
            options.paperHeight = parseFloat(this.options.paperHeight);
        }
		
        if(this.options.timeout !== undefined) {
            options.timeout = Math.round(parseFloat(this.options.timeout));
        }
        return options;
    }
	
	
    generateCaptureOptions() {
        const options = {};

		
        if(this.options.captureFormat !== undefined) {
			     if( this.options.captureFormat.match(/png/i)      ) options.captureFormat = 'png';
			else if( this.options.captureFormat.match(/jpg|jpeg/i) ) options.captureFormat = 'jpeg';
        }
		
        if(this.options.captureQuality !== undefined) {
            let quality = Math.round(parseFloat(this.options.captureQuality));
			if(quality>100)quality=100;
			if(quality<0)quality=0;
			options.captureQuality=quality;
        }
		
        if(this.options.saveFormat !== undefined) {
			let format=this.options.saveFormat;
			     if( format.match(/jpgpdf|jpegpdf/i) ) options.saveFormat = 'jpegpdf';
			else if( format.match(/pngpdf/i) ) options.saveFormat = 'pngpdf';
			else if( format.match(/png/i) ) options.saveFormat = 'png';
			else if( format.match(/jpg|jpeg/i) ) options.saveFormat = 'jpeg';
        }
		
        if(this.options.saveQuality !== undefined) {
            let quality = Math.round(parseFloat(this.options.saveQuality));
			if(quality>100)quality=100;
			if(quality<0)quality=0;
			options.saveQuality=quality;
        }
		
		
        if(this.options.dpi !== undefined) {
            options.dpi = parseFloat(this.options.dpi);
        }
        if(this.options.captureStepHeight !== undefined) {
            options.captureStepHeight = parseFloat(this.options.captureStepHeight);
        }

        if(this.options.paperWidth !== undefined) {
            options.paperWidth = parseFloat(this.options.paperWidth);
        }

        if(this.options.paperHeight !== undefined) {
            options.paperHeight = parseFloat(this.options.paperHeight);
        }
		
        if (this.options.fromSurface !== undefined) {
            options.fromSurface = !!this.options.fromSurface;
        }
 
		if (this.options.clip) {
			let  x=0
				,y=0
				,width=1600
				,height=1200
				,scale=1;
				
			if(this.options.clip.x !== undefined) {
				x = parseFloat(this.options.clip.x)
			}
			if(this.options.clip.width !== undefined) {
				width = parseFloat(this.options.clip.width)
			}
			if(this.options.clip.height !== undefined) {
				height = parseFloat(this.options.clip.height)
			}
			if(this.options.clip.scale !== undefined) {
				scale = parseFloat(this.options.clip.scale)
			}
			
			options.clip={
				 x
				,y
				,width
				,height
				,scale
			};
        }
		
        if(this.options.timeout !== undefined) {
            options.timeout = Math.round(parseFloat(this.options.timeout));
        }
		
        return options;
    }

    error(...msg) {
        if (this.options.printErrors) {
            console.error(...msg);
        }
    }

    log(...msg) {
        if (this.options.printLogs) {
            console.log(...msg);
        }
    }

    async cbToPromise(cb) {
        return new Promise((resolve) => {
            cb((resp) => {
                resolve(resp);
            })
        });
    }

    getPerfTime(prev) {
        const time = process.hrtime(prev);
        return time[0] * 1e3 + time[1] / 1e6;
    }

    async profileScope(msg, cb) {
        const start = process.hrtime();
        await cb();
        this.log(msg, `took ${Math.round(this.getPerfTime(start))}ms`);
    }

    browserLog(type, msg) {
            this.log(`(chrome) (${type}) `,msg.constructor.name==='Socket'?'Socket':msg);
     
    }

    async spawnChrome() {
        const chromeExec = this.options.chromeBinary || await this.detectChrome();
        this.log('Using', chromeExec);
		var isWin = /^win/.test(process.platform);
        const commandLineOptions = [
		     '--headless', 
             '--no-sandbox', 
             '--interpreter-none', 
             '--disable-translate', 
             '--disable-extensions', 
             '--safebrowsing-disable-auto-update', 
             '--disable-metrics', 
             '--disable-default-apps', 
             '--no-first-run', 
             '--mute-audio', 
             '--hide-scrollbars', 
             '--disable-plugins', 
             '--disable-sync', 
             '--incognito',
             isWin?'--disk-cache-dir=null':'--disk-cache-dir=/dev/null',
             `--remote-debugging-port=${this.port}`, 
             '--disable-gpu'
            ]; 

        if (this.commandLineOptions.windowSize !== undefined ) {
          commandLineOptions.push(`--window-size=${this.commandLineOptions.windowSize[0]},${this.commandLineOptions.windowSize[1]}`);
        }

        if (this.commandLineOptions.extraOptions !== undefined) {
          commandLineOptions.push.apply(commandLineOptions, this.commandLineOptions.extraOptions);
        }

        this.chrome = cp.spawn(
            chromeExec,
            commandLineOptions
        );
        this.chrome.on('close', (code) => {
            this.log(`Chrome stopped (${code})`);
            this.browserLog('out', this.chrome.stdout);
            this.browserLog('err', this.chrome.stderr);
        });
    }

    async isCommandExists(cmd) {
        return new Promise((resolve, reject) => {
            commandExists(cmd, (err, exists) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(exists);
                }
            })
        });
    }

    async detectChrome() {
        if (await this.isCommandExists('google-chrome-unstable')) {
            return 'google-chrome-unstable';
        }
        if (await this.isCommandExists('google-chrome-beta')) {
            return 'google-chrome-beta';
        }
        if (await this.isCommandExists('google-stable')) {
            return 'google-stable';
        }
        if (await this.isCommandExists('google-chrome')) {
            return 'google-chrome';
        }
        if (await this.isCommandExists('chromium')) {
            return 'chromium';
        }
        if (await this.isCommandExists('chromium-browser')) {
            return 'chromium-browser';
        }
		
        // windows
        if (await this.isCommandExists('chrome')) { 
            return 'chrome';
        }
		
		var isWin = /^win/.test(process.platform);

        if (isWin&&fs.statSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe').isFile()) {
            return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
        }
        if (isWin&&fs.statSync(process.env.ProgramFiles+'\\Google\\Chrome\\Application\\chrome.exe').isFile()) {
            return process.env.ProgramFiles+'\\Google\\Chrome\\Application\\chrome.exe';
        }
        if (isWin&&fs.statSync(process.env['ProgramFiles(x86)']+'\\Google\\Chrome\\Application\\chrome.exe').isFile()) {
            return process.env['ProgramFiles(x86)']+'\\Google\\Chrome\\Application\\chrome.exe';
        }
		
        // macos
        if (await this.isCommandExists('/Applications/Google\ Chrome Canary.app/Contents/MacOS/Google\ Chrome')) {
            return '/Applications/Google\ Chrome Canary.app/Contents/MacOS/Google\ Chrome';
        }
        if (await this.isCommandExists('/Applications/Google\ Chrome Dev.app/Contents/MacOS/Google\ Chrome')) {
            return '/Applications/Google\ Chrome Dev.app/Contents/MacOS/Google\ Chrome';
        }
        if (await this.isCommandExists('/Applications/Google\ Chrome Beta.app/Contents/MacOS/Google\ Chrome')) {
            return '/Applications/Google\ Chrome Beta.app/Contents/MacOS/Google\ Chrome';
        }
        if (await this.isCommandExists('/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome')) {
            return '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
        }
        throw Error('Couldn\'t detect chrome version installed! use --chrome-binary to pass custom location');
    }

    killChrome() {
        this.chrome.kill(cp.SIGKILL);
    }

    async waitForDebugPort() {
        this.log('Waiting for chrome to became available');
        while (true) {
            try {
                await this.isPortOpen('localhost', this.port);
                this.log('Connected!');
                return;
            } catch (e) {
                await this.wait(10);
            }
        }
    }

    async isPortOpen(host, port) {
        return new Promise(function (resolve, reject) {
            const connection = new net.Socket();
            connection.connect({host, port});
            connection.on('connect', () => {
                connection.end();
                resolve();
            });
            connection.on('error', () => {
                reject();
            })
        });
    }

    async wait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = RenderPDF;
module.exports.default = RenderPDF;
