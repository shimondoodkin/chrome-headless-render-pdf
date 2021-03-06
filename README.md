# This tool require Google Chrome installed in version min 59 to work!

# Usage: 
```
chrome-headless-render-pdf [OPTIONS] --url=URL --pdf=OUTPUT-FILE [--url=URL2 --pdf=OUTPUT-FILE2] ...
  Options:
    --help                   this screen
    --url                    url to load, for local files use: file:///path/to/file
    --pdf                    output for generated file can be relative to current directory
    --chrome-binary          set chrome location (use this options when autodetection fail)
    --no-margins             disable default 1cm margins
    --include-background     include elements background
    --landscape              generate pdf in landscape orientation
    --window-size            specify window size, width(,x*)height (e.g. --window-size 1600,1200 or --window-size 1600x1200)
    --paper-width            specify page width in inches (defaults to 8.5 inches)
    --paper-height           specify page height in inches (defaults to 11 inches)
    --extra-cli-options      extra command line options to be passed directly to the chrome binary on the command line (ex. --extra-cli-options="--ignore-certificate-errors --hide-scrollbars"

  Example:
    Render single pdf file
      chrome-headless-render-pdf --url http://google.com --pdf test.pdf
    Render pdf from local file
      chrome-headless-render-pdf --url file:///tmp/example.html --pdf test.pdf
    Render multiple pdf files
      chrome-headless-render-pdf --url http://google.com --pdf test.pdf --url file:///tmp/example.html --pdf test.pdf
```

# This tool can be also used programmatically:
```
const RenderPDF = require('chrome-headless-render-pdf');
RenderPDF.generateSinglePdf({url:'http://google.com', pdf:'outputPdf.pdf'});
```

```
const RenderPDF = require('chrome-headless-render-pdf');
RenderPDF.generateMultiplePdf([
    {url: 'http://google.com' , pdf:'outputPdf.pdf' },
    {url: 'http://example.com', pdf:'outputPdf2.pdf'}
]);
```

```
const RenderPDF = require('chrome-headless-render-pdf');
RenderPDF.generatePdfBuffer('http://google.com')
    .then((pdfBuffer) => {
      console.log(pdfBuffer);
    });
```

# you can also use it from typescript or es6
```
import RenderPDF from 'chrome-headless-render-pdf';
RenderPDF.generateSinglePdf({url:'http://google.com', pdf:'outputPdf.pdf'});
```

# Motivation
google-chrome currently have option to render pdf files when used with headless option. 
But this option contains hardcoded adding header and footer to page rendering it unusable for pdf generation.
This module allows to generate it without those elements.
