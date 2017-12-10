// this code is not a working example, but you can see how i used it

// i had to render svg. chrome renders svg better than librsvg and printers (or even printed chrome pdfs that arre in post script)
//
// i was doing svg rendering using node js in order to print it,
// it was rendered vary poorly ,even looking ok on pdfs it was looking bad on paper
// so it tried to make screen shot
// to make 600 dpi image i simply made a 600 image on 
// regular dpi display (it is simply large on screen) ,i tried zooming, but
// it makes capturing and rendering it very slow.
//
// it is faster to open files, i had to make a no disk usage solution. so i added script argument(then it required to scrolll also with the script, befer that it didn't).
//
// i had very large area, larger than screen places were with white rects, not rendered.
// so i made a solution of capturing parts then composing them.
//
// then i convert it to pdf
//
// it is possible to make a jpg or png or jpgpdf or pngpdf.
//
// there is no multi page pages support
// 
// if paperWidth and paperHeight are not specified, it makes pdf of size of pixels at dpi
//
//  I opensourced this. however, i don't have budget to make better code or examples at the moment.
//  if anyone wants to develop a proper commit you are welcome
//
// also i did not developed the usage methods, just the underlying low level method
//
// to install it i write 
// on windows:
// npm install --save shimondoodkin/chrome-headless-render-pdf#master
// on linux
// npm install --save shimondoodkin/chrome-headless-render-pdf\#master


import {loadNodejs,generatePages} from 'print/sections/print-view/raws'
import util from 'util'
import fs from 'fs'
//import {Rsvg} from 'librsvg';
import RenderPDF from 'chrome-headless-render-pdf';
const writeFilePromise = util.promisify(fs.writeFile);

function addslashes(string) {
    return string.replace(/\\/g, '\\\\').
        replace(/\u0008/g, '\\b').
        replace(/\t/g, '\\t').
        replace(/\n/g, '\\n').
        replace(/\f/g, '\\f').
        replace(/\r/g, '\\r').
        replace(/'/g, '\\\'').
        replace(/"/g, '\\"');
}

(async ()=>{


	let svgDatas = await loadNodejs();

	//console.log('svgs?', svgDatas)

	let pages=await generatePages(svgDatas,600); 
	let  renderer=null;
		console.log('done generating')
	try{
		

		let toconvert=[];
		
		await Promise.all(pages.map( (page,i) =>
		{

			return Promise.all([ 
								 writeFilePromise(__dirname+'/out/'+i+'front.svg',  page.front  )  .then( ()=>  toconvert.push({ data:page.front  , url:'file://'+__dirname+'/out/'+i+'front.svg'  ,pdf: __dirname+'/out/'+i+'front.pdf'  ,png: __dirname+'/out/'+i+'front.png'  }  ))
							   , writeFilePromise(__dirname+'/out/'+i+'fronta.svg', page.fronta )  .then( ()=>  toconvert.push({ data:page.fronta , url:'file://'+__dirname+'/out/'+i+'fronta.svg' ,pdf: __dirname+'/out/'+i+'fronta.pdf' ,png: __dirname+'/out/'+i+'fronta.png' }  ))
							   , writeFilePromise(__dirname+'/out/'+i+'frontb.svg', page.frontb )  .then( ()=>  toconvert.push({ data:page.frontb , url:'file://'+__dirname+'/out/'+i+'frontb.svg' ,pdf: __dirname+'/out/'+i+'frontb.pdf' ,png: __dirname+'/out/'+i+'frontb.png' }  ))
							   , writeFilePromise(__dirname+'/out/'+i+'back.svg',   page.back   )  .then( ()=>  toconvert.push({ data:page.back   , url:'file://'+__dirname+'/out/'+i+'back.svg'   ,pdf: __dirname+'/out/'+i+'back.pdf'   ,png: __dirname+'/out/'+i+'back.png'   }  ))
							   , writeFilePromise(__dirname+'/out/'+i+'backa.svg',  page.backa  )  .then( ()=>  toconvert.push({ data:page.backa  , url:'file://'+__dirname+'/out/'+i+'backa.svg'  ,pdf: __dirname+'/out/'+i+'backa.pdf'  ,png: __dirname+'/out/'+i+'backa.png'  }  ))
							   , writeFilePromise(__dirname+'/out/'+i+'backb.svg',  page.backb  )  .then( ()=>  toconvert.push({ data:page.backb  , url:'file://'+__dirname+'/out/'+i+'backb.svg'  ,pdf: __dirname+'/out/'+i+'backb.pdf'  ,png: __dirname+'/out/'+i+'backb.png'  }  ))
							  ])
		}));
	 
		console.log('done saving')
		
	      renderer = new RenderPDF({
			 'paperHeight': 11.693 // parseFloat((297000/25400).toFixed(3)) // = 11.693 // A4 page size
			,'paperWidth':  8.268  // parseFloat((210000/25400).toFixed(3)) // = 8.268 
			,noMargins:true
			,printLogs:true

			
			,captureFormat:'jpg'
			,captureQuality:100
			,saveFormat:'jpgpdf' //can be pngpdf jpegpdf jpg png
			,saveQuality:80
			//,fromSurface:true // not sure what it does
			,clip:{
			 x:0 //number X offset in CSS pixels.
			,y:0 //number Y offset in CSS pixels
			,width: Math.round(pages[0].width) //number Rectangle width in CSS pixels
			,height:Math.round(pages[0].height) //number Rectangle height in CSS pixels
			,scale:1 //number Page scale factor.
			}
			,dpi:600 // usual dpi is 96
			
			
			,timeout:60000
			,captureStepHeight:2000
			,windowSize :[Math.round(pages[0].width) //number Rectangle width in CSS pixels
						 , pages[0].height>2000?2000:pages[0].height ] //number Rectangle height in CSS pixels
						 
			,chromeBinary:'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
			  

		  });
		
		console.log('chrome spawning')
        await renderer.spawnChrome();
		
		console.log('chrome waitForDebugPort')
        await renderer.waitForDebugPort();
		
	    for (const job of toconvert.filter(a=>a.url.match(/back\./)!==null)) {
			console.log('converting '+job.url);

            //const buff = await renderer.renderPdf(job.url, renderer.generatePdfOptions());
            //const buff = await renderer.renderCapture(job.url, renderer.generateCaptureOptions());			
            const buff = await renderer.renderCapture('about:blank', renderer.generateCaptureOptions(), 'window.document.write(\''+addslashes(job.data)+'\');document.style.backgroundColor="blue";' );

			      fs.writeFileSync(job.pdf, buff);
            renderer.log(`Saved ${job.pdf}`);
        }
		
	}
	catch(e)
	{
		console.log(e.stack)
	}
	finally
	{
		if(renderer)
			renderer.killChrome();
	}
 
})()

 
 
 /// non essencial junk code:



function svg_to_dataUri(body) {
	const type = 'image/svg+xml';
	const prefix = "data:" + type + ";base64,";
	const base64 = new Buffer(body, 'binary').toString('base64');
	return prefix + base64;
}

//
//async function chrome_to_pdfs(pairs,options) {
//	try{
//	    const renderer = new RenderPDF(options);
//        await renderer.spawnChrome();
//        await renderer.waitForDebugPort();
//        for (const job of pairs) {
//                //job.buff = (await renderer.renderPdf(svg_to_dataUri(filetext), renderer.generatePdfOptions())).buff;
//                job.buff = (await renderer.renderPdf(job.url, renderer.generatePdfOptions())).buff;
//        }		
//	}
//	catch(e) 
//	{
//		throw e;
//	}
//	finally
//	{
//		
//        renderer.killChrome();
//	}
//	return pairs;
//}

//function svg_to_ps(svgtext){
//	return new Promise((resolve,reject)=>{
//		// Create SVG render instance.
//		var svg = new Rsvg();
//		
//		// When finishing reading SVG, render and save as PNG image.
//		svg.on('finish', function() {
//		  //console.log('SVG width: ' + svg.width);
//		  //console.log('SVG height: ' + svg.height);
//		  resolve( svg.render({
//			format: 'ps',
//			width: svg.width,
//			height: svg.height
//		  }).data )
//		  
//		});
//		
//		svg.end(svgtext);
//
//	});
//}
//function svg_to_pdf(svgtext){
//	return new Promise((resolve,reject)=>{
//		// Create SVG render instance.
//		var svg = new Rsvg();
//		
//		// When finishing reading SVG, render and save as PNG image.
//		svg.on('finish', function() {
//		  //console.log('SVG width: ' + svg.width);
//		  //console.log('SVG height: ' + svg.height);
//		  resolve( svg.render({
//			format: 'pdf',
//			width: svg.width,
//			height: svg.height
//		  }).data )
//		  
//		});
//		
//		svg.end(svgtext);
//
//	});
//}



 
