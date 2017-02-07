// == openjscad.js, originally written by Joost Nieuwenhuijse (MIT License)
//   few adjustments by Rene K. Mueller <spiritdude@gmail.com> for OpenJSCAD.org
//   adapted by jw1401 as an Customiozation Engine for 3D Printing
//
// History:
//

(function(module)
{

var OpenJsCad = function() { };

module.OpenJsCad = OpenJsCad;

OpenJsCad.version = '0.5.2 (2016/10/01)';

//Logging Function for debugging
//
OpenJsCad.log = function(txt)
{
  var timeInMs = Date.now();
  var prevtime = OpenJsCad.log.prevLogTime;
  if(!prevtime) prevtime = timeInMs;
  var deltatime = timeInMs - prevtime;
  OpenJsCad.log.prevLogTime = timeInMs;
  var timefmt = (deltatime*0.001).toFixed(3);
  txt = "["+timefmt+"] "+txt;

  if( (typeof(console) == "object") && (typeof(console.log) == "function") )
  {
    console.log(txt);
  }
  else if( (typeof(self) == "object") && (typeof(self.postMessage) == "function") )
  {
    self.postMessage({cmd: 'log', txt: txt});
  }
  else throw new Error("Cannot log");
};

//?????????????
/*
OpenJsCad.status = function(s)
{
  OpenJsCad.log(s);
}*/

OpenJsCad.env = function()
{
  var env = "OpenJSCAD "+OpenJsCad.version;
  if(typeof document !== 'undefined')
  {
    var w = document.defaultView;
    env = env+" ["+w.navigator.userAgent+"]";
  } else
  {
    if (typeof require == 'function')
    {
      var os = require("os");
      env = env+" ["+os.type()+":"+os.release()+","+os.platform()+":"+os.arch()+"]";
    }
  }
  console.log(env);
}


///////////////////////////////////////////////////////////////////////////////
// this is a bit of a hack; doesn't properly supports urls that start with '/'
// but does handle relative urls containing ../
//
OpenJsCad.makeAbsoluteUrl = function(url, baseurl)
{
  if(!url.match(/^[a-z]+\:/i))
  {
    var basecomps = baseurl.split("/");

    if(basecomps.length > 0)
    {
      basecomps.splice(basecomps.length - 1, 1);
    }

    var urlcomps = url.split("/");
    var comps = basecomps.concat(urlcomps);
    var comps2 = [];

    comps.map(function(c)
    {
      if(c == "..")
      {
        if(comps2.length > 0)
        {
          comps2.splice(comps2.length - 1, 1);
        }
      } else
      {
        comps2.push(c);
      }
    });

    url = "";

    for(var i = 0; i < comps2.length; i++)
    {
      if(i > 0) url += "/";
      url += comps2[i];
    }
  }
  return url;
};

OpenJsCad.isChrome = function()
{
  return (window.navigator.userAgent.search("Chrome") >= 0);
};

OpenJsCad.isSafari = function()
{
  return /Version\/[\d\.]+.*Safari/.test(window.navigator.userAgent); // FIXME WWW says don't use this
}

OpenJsCad.getWindowURL = function()
{
  if(window.URL) return window.URL;
  else if(window.webkitURL) return window.webkitURL;
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.textToBlobUrl = function(txt)
{
  var windowURL=OpenJsCad.getWindowURL();
  var blob = new Blob([txt], { type : 'application/javascript' });
  var blobURL = windowURL.createObjectURL(blob);
  if(!blobURL) throw new Error("createObjectURL() failed");
  return blobURL;
};

OpenJsCad.revokeBlobUrl = function(url)
{
  if(window.URL) window.URL.revokeObjectURL(url);
  else if(window.webkitURL) window.webkitURL.revokeObjectURL(url);
  else throw new Error("Your browser doesn't support window.URL");
};

OpenJsCad.FileSystemApiErrorHandler = function(fileError, operation)
{
  var errormap =
      {
        1: 'NOT_FOUND_ERR',
        2: 'SECURITY_ERR',
        3: 'ABORT_ERR',
        4: 'NOT_READABLE_ERR',
        5: 'ENCODING_ERR',
        6: 'NO_MODIFICATION_ALLOWED_ERR',
        7: 'INVALID_STATE_ERR',
        8: 'SYNTAX_ERR',
        9: 'INVALID_MODIFICATION_ERR',
        10: 'QUOTA_EXCEEDED_ERR',
        11: 'TYPE_MISMATCH_ERR',
        12: 'PATH_EXISTS_ERR',
      };

  var errname;

  if(fileError.code in errormap)
  {
    errname = errormap[fileError.code];
  }
  else
  {
    errname = "Error #"+fileError.code;
  }

  var errtxt = "FileSystem API error: "+operation+" returned error "+errname;
  throw new Error(errtxt);
};

// Call this routine to install a handler for uncaught exceptions
//
OpenJsCad.AlertUserOfUncaughtExceptions = function()
{
  window.onerror = function(message, url, line) {

    var msg = "uncaught exception";

    switch (arguments.length)
    {
      case 1: // message
        msg = arguments[0];
        break;
      case 2: // message and url
        msg = arguments[0]+'\n('+arguments[1]+')';
        break;
      case 3: // message and url and line#
        msg = arguments[0]+'\nLine: '+arguments[2]+'\n('+arguments[1]+')';
        break;
      case 4: // message and url and line# and column#
      case 5: // message and url and line# and column# and Error
        msg = arguments[0]+'\nLine: '+arguments[2]+',col: '+arguments[3]+'\n('+arguments[1]+')';
        break;
      default:
        break;
    }

    if(typeof document == 'object')
    {
      var e = document.getElementById("errordiv");

      if (e !== null)
      {
        e.firstChild.textContent = msg;
        e.style.display = "block";
      }

    }
      else
    {
      console.log(msg);
    }
    return false;
  };
};

// parse the jscad script to get the parameter definitions in the getParameterDefintions (returns array) Function in the jsCad File
//
OpenJsCad.getParamDefinitions = function(script)
{
  var scriptisvalid = true;
  script += "\nfunction include() {}";    // at least make it not throw an error so early

  try
  {
    // first try to execute the script itself; this will catch any syntax errors
    (new Function(script))();
  }
  catch(e)
  {
    scriptisvalid = false;
  }

  var params = [];

  if(scriptisvalid)
  {
    var script1 = "if(typeof(getParameterDefinitions) == 'function') {return getParameterDefinitions();} else {return [];} ";
    script1 += script;

    var f = new Function(script1);
    params = f();

    if( (typeof(params) != "object") || (typeof(params.length) != "number") )
    {
      throw new Error("The getParameterDefinitions() function should return an array with the parameter definitions");
    }
  }

  //returns the getParameterDefinitions array for ParametersDiv
  return params;
};



////////////////////////////////////////////////////////////////////////////////
//OpenJsCadProcessor
//
//
//
OpenJsCad.Processor = function(containerdiv, options, onchange)
{
  //pass in div which contains viewerContext
  this.containerdiv = containerdiv;

  //initialize Options and pass in options if available or generate empty options Object
  this.options = options = options || {};

  //????
  //this.onchange = onchange;

  //checks if options passed in by Constructor or not, if not then asign standard option
  // Draw black triangle lines ("wireframe")
  this.options.drawLines = !!this.cleanOption(options.drawLines, false);
  // Draw surfaces
  this.options.drawFaces = !!this.cleanOption(options.drawFaces, true);
  // verbose output
  this.options.verbose = !!this.cleanOption(options.verbose, true);

  // default applies unless sizes specified in options
  this.widthDefault = "800px";
  this.heightDefault = "600px";

  this.viewerdiv = null;
  this.viewer = null;

  this.viewerSize =
  {
    widthDefault: this.widthDefault,
    heightDefault: this.heightDefault,
    width: this.options.viewerwidth,
    height: this.options.viewerheight,
    heightratio: this.options.viewerheightratio
  };

  this.processing = false;
  this.currentObject = null;
  this.hasValidCurrentObject = false;
  this.hasOutputFile = false;
  this.worker = null;
  this.paramDefinitions = [];
  this.paramControls = [];
  this.script = null;
  this.hasError = false;
  this.formats = null;


  // the default options for processing
  this.opts =
  {
    libraries: ['csg.js','formats.js','openjscad.js','openscad.js'],
    openJsCadPath: 'Viewer/js/',
    useAsync: true,
    useSync:  true,
  };


  // callbacks
  this.onchange = null;   // function(Processor) for callback
  this.ondownload = null; // function(Processor) for callback

  this.currentObjects = [];  // list of objects returned from rebuildObject*
  this.viewedObject = null;  // the object being rendered

  this.selectStartPoint = 0;
  this.selectEndPoint = 0;

  this.baseurl = document.location.href;
  this.baseurl = this.baseurl.replace(/#.*$/,''); // remove remote URL
  this.baseurl = this.baseurl.replace(/\?.*$/,''); // remove parameters
  if (this.baseurl.lastIndexOf('/') != (this.baseurl.length-1))
  {
    this.baseurl = this.baseurl.substring(0,this.baseurl.lastIndexOf('/')+1);
  }

  // state of the processor
  // 0 - initialized - no viewer, no parameters, etc
  // 1 - processing  - processing JSCAD script
  // 2 - complete    - completed processing
  // 3 - incomplete  - incompleted due to errors in processing

  this.state = 0;

  this.createElements();
};

// makes Objects ready to display with csg fixTJunctions
//
OpenJsCad.Processor.convertToSolid = function(objs)
{
  if (objs.length === undefined)
  {
    if ((objs instanceof CAG) || (objs instanceof CSG))
    {
      var obj = objs;
      objs = [obj];
    }
    else
    {
      throw new Error("Cannot convert object ("+typeof(objs)+") to solid");
    }
  }

  var solid = null;

  for(var i=0; i<objs.length; i++)
  {
    var obj = objs[i];

    if (obj instanceof CAG)
    {
      obj = obj.extrude({offset: [0,0,0.1]}); // convert CAG to a thin solid CSG
    }

    if (solid !== null)
    {
      solid = solid.unionForNonIntersecting(obj);
    }
    else
    {
      solid = obj;
    }
  }

  return solid;
};


// Most functions are in here
//
OpenJsCad.Processor.prototype =
{

    //checks if options are available, if not then returns the option assigned in the function call
    //
    cleanOption: function(option, deflt)
    {
        return typeof option != "undefined" ? option : deflt;
    },

    // draw options can be toggled from code or UI, its done here
    // pass "faces" or "lines"; viewer calls means OpenJsCadViewer calls
    //
    toggleDrawOption: function(str)
    {
        if (str == 'faces' || str == 'lines')
        {
            var newState = !this.viewer.drawOptions[str];//inverses bool
            this.setDrawOption(str, newState);
            return newState;
        }
    },

    // sets the draw options in the OpenJsCadViewer
    // e.g. setDrawOption('lines', false);
    //
    setDrawOption: function(str, bool)
    {
        if (str == 'faces' || str == 'lines')
        {
            this.viewer.drawOptions[str] = !!bool;
        }
        this.viewer.applyDrawOptions(); // calls the OpenJsCadViewer.applyDrawOptions function
    },

    handleResize: function()
    {
        this.viewer && (this.viewer.handleResize());
    },


    //is called from OpenJsCad.processor
    //
    //this creates
    //
    //    --viewerdiv
    //    --instances the OpenJsCadViewer which can be referenced by this.viewer in here
    //    --updatediv
    //    --statusdiv
    //    --parametersdiv
    //    --ErrorDiv
    //    --selectdiv ==> select the Range of objects to display
    //
    createElements: function()
    {
        var that = this;   // for event handlers

        while(this.containerdiv.children.length > 0)
        {
            this.containerdiv.removeChild(this.containerdiv.firstChild);
        }

        var viewerdiv = document.createElement("div");
        viewerdiv.className = "viewer";
        viewerdiv.style.width = '100%';
        viewerdiv.style.height = '100%';
        this.containerdiv.appendChild(viewerdiv);

        try
        {
            this.viewer = new OpenJsCadViewer.Viewer(viewerdiv,this.viewerSize, this.options);//this.opts.viewer);
        }
        catch(e)
        {
            viewerdiv.innerHTML = "<b><br><br>Error: " + e.toString() + "</b><br><br>A browser with support for WebGL is required";
        }


        this.selectdiv = this.containerdiv.parentElement.querySelector("div#selectdiv");
        if (!this.selectdiv)
        {
            this.selectdiv = document.createElement("div");
            this.selectdiv.id = 'selectdiv';
            this.containerdiv.parentElement.appendChild(this.selectdiv);
        }

        element = document.createElement("input");
        element.setAttribute("type", "range");
        element.id = 'startRange';
        element.min = 0;
        element.max = 100;
        element.step = 1;
        element.oninput = function(e) {
            if( that.state == 2 )
            {
                that.updateView();
                that.updateFormats();
                that.updateDownloadLink();
            }};

        this.selectdiv.appendChild(element);

        element = document.createElement("input");
        element.setAttribute("type", "range");
        element.id = 'endRange';
        element.min = 0;
        element.max = 100;
        element.step = 1;
        element.oninput = function(e) {

            if( that.state == 2 )
            {
                that.updateView();
                that.updateFormats();
                that.updateDownloadLink();
            }};

        this.selectdiv.appendChild(element);

        ////////ErrorDiv
        this.errordiv = this.containerdiv.parentElement.querySelector("div#errordiv");
        if (!this.errordiv)
        {
            this.errordiv = document.createElement("div");
            this.errordiv.id = 'errordiv';
            this.containerdiv.parentElement.appendChild(this.errordiv);
        }

        this.errorpre = document.createElement("pre");
        this.errordiv.appendChild(this.errorpre);

        ////////StatusDiv
        this.statusdiv = this.containerdiv.parentElement.querySelector("div#statusdiv");
        while (this.statusdiv.hasChildNodes())
        {

            this.statusdiv.removeChild(this.statusdiv.lastChild);

        }

        if (!this.statusdiv)
        {
            this.statusdiv = document.createElement("div");
            this.statusdiv.id = "statusdiv";
            this.containerdiv.parentElement.appendChild(this.statusdiv);
        }

        this.statusspan = document.createElement("span");
        this.statusspan.id = 'statusspan';
        this.statusbuttons = document.createElement("span");
        this.statusbuttons.id = 'statusbuttons';
        this.statusdiv.appendChild(this.statusspan);
        this.statusdiv.appendChild(this.statusbuttons);
        this.abortbutton = document.createElement("button");
        this.abortbutton.innerHTML = "Abort";
        this.abortbutton.onclick = function(e) {that.abort();};

        this.statusbuttons.appendChild(this.abortbutton);
        this.formatDropdown = document.createElement("select");

        this.formatDropdown.onchange = function(e) {
            that.currentFormat = that.formatDropdown.options[that.formatDropdown.selectedIndex].value;
            that.updateDownloadLink();};

        this.statusbuttons.appendChild(this.formatDropdown);
        this.generateOutputFileButton = document.createElement("button");
        this.generateOutputFileButton.onclick = function(e) {that.generateOutputFile();};

        this.statusbuttons.appendChild(this.generateOutputFileButton);
        this.downloadOutputFileLink = document.createElement("a");
        this.downloadOutputFileLink.className = "downloadOutputFileLink"; // so we can css it
        this.statusbuttons.appendChild(this.downloadOutputFileLink);

        ////////ParametersDiv
        this.parametersdiv = this.containerdiv.parentElement.querySelector("div#parametersdiv");
        while (this.parametersdiv.hasChildNodes())
        {

            this.parametersdiv.removeChild(this.parametersdiv.lastChild);

        }

        if (!this.parametersdiv)
        {
            this.parametersdiv = document.createElement("div");
            this.parametersdiv.id = "parametersdiv";
            this.containerdiv.parentElement.appendChild(this.parametersdiv);
        }

        ////////UpdateDiv
        this.updatediv = this.containerdiv.parentElement.querySelector("div#updatediv");
        while (this.updatediv.hasChildNodes())
        {

            this.updatediv.removeChild(this.updatediv.lastChild);

        }

        if (!this.updatediv)
        {
            this.updatediv = document.createElement("div");
            this.updatediv.id = "updatediv";
            this.containerdiv.parentElement.appendChild(this.updatediv);
        }

        element = document.createElement("button");
        element.innerHTML = "Update";
        element.id = "updateButton";
        element.onclick = function(e) {that.rebuildSolid();};

        this.updatediv.appendChild(element);

        var instantUpdateCheckbox = document.createElement("input");
        instantUpdateCheckbox.type = "checkbox";
        instantUpdateCheckbox.id = "instantUpdate";
        instantUpdateCheckbox.checked = true;
        this.updatediv.appendChild(instantUpdateCheckbox);

        element = document.getElementById("instantUpdateLabel");
        if (element === null)
        {
            element = document.createElement("label");
            element.innerHTML = "Instant Update";
            element.id = "instantUpdateLabel";
        }
        element.setAttribute("for",instantUpdateCheckbox.id);

        this.updatediv.appendChild(element);

        //ParametersTable is filled by createParamControls
        this.parameterstable = document.createElement("table");
        this.parameterstable.className = "parameterstable";
        this.parametersdiv.appendChild(this.parameterstable);

        this.enableItems();

        this.clearViewer();
    },

    getFilenameForRenderedObject: function()
    {
        var filename = this.filename;
        if(!filename) filename = "openjscad";
        var index = this.renderedElementDropdown.selectedIndex;

        if(index >= 0)
        {
            var renderedelement = this.currentObjects[index];
            if('name' in renderedelement)
            {
                filename = renderedelement.name;
            }
            else
            {
                filename += "_"+(index + 1);
            }
        }
        return filename;
    },

    // sets the current Objects to display, updates the view, the Formats and the downloadLinkTextForCurrentObject
    //
    setCurrentObjects: function(objs)
    {
        if (!(length in objs))
        {
            objs = [objs]; // create a list
        }

        this.currentObjects = objs;  // list of CAG or CSG objects

        this.updateSelection();

        this.selectStartPoint = -1; // force view update

        this.updateView();
        this.updateFormats();
        this.updateDownloadLink();

        if(this.onchange) this.onchange(this);
    },

    selectedFormat: function()
    {
        return this.formatDropdown.options[this.formatDropdown.selectedIndex].value;
    },

    selectedFormatInfo: function()
    {
        return this.formatInfo(this.selectedFormat());
    },

    // updates the text in the Generate Output File button
    //
    updateDownloadLink: function()
    {
        var info = this.selectedFormatInfo();
        var ext = info.extension;
        this.generateOutputFileButton.innerHTML = "Generate " + ext.toUpperCase();
    },

    //saves nummbers of 3D objects
    //in hidden Range Element in HTML
    //
    updateSelection: function()
    {
        var range = document.getElementById("startRange");
        range.min = 0;
        range.max = this.currentObjects.length - 1;
        range.value = 0;
        range = document.getElementById("endRange");
        range.min = 0;
        range.max = this.currentObjects.length - 1;
        range.value = this.currentObjects.length - 1;
    },

    // updates the view based on the selected objects
    //
    updateView: function()
    {
        // get parameters from selectdiv slides
        var startpoint = parseInt(document.getElementById("startRange").value);
        var endpoint = parseInt(document.getElementById("endRange").value);
        if (startpoint == this.selectStartPoint && endpoint == this.selectEndPoint) { return; }

        // build a list of objects to view
        this.selectStartPoint = startpoint;
        this.selectEndPoint   = endpoint;

        if (startpoint > endpoint) { startpoint = this.selectEndPoint; endpoint = this.selectStartPoint; };

        //selects the Elements to render based on the selct div function
        var objs = this.currentObjects.slice(startpoint,endpoint+1);

        // enforce CSG to display ==> important function convertToSolid()
        //
        this.viewedObject = OpenJsCad.Processor.convertToSolid(objs);

        //determines if this is first rendering; if true the reset zoom
        this.isFirstRender_ = typeof this.isFirstRender_ == 'undefined' ? true : false;

        // (re-)set zoom only on very first rendering action
        this.viewer.setCsg(this.viewedObject, this.isFirstRender_);
        this.hasValidCurrentObject = true;

        if(this.viewer)
        {
            //sets the viewer and displays objects
            this.viewer.setCsg(this.viewedObject);
        }
    },

    // updates the Format DropDown list
    //
    updateFormats: function()
    {
        while(this.formatDropdown.options.length > 0)
        {
            this.formatDropdown.options.remove(0);
        }

        var that = this;

        var formats = this.supportedFormatsForCurrentObjects();

        formats.forEach(function(format)
        {
            var option = document.createElement("option");
            var info = that.formatInfo(format);
            option.setAttribute("value", format);
            option.appendChild(document.createTextNode(info.displayName));
            that.formatDropdown.options.add(option);
        });
    },

    // clears the Viewer and the Output File
    //
    clearViewer: function()
    {
        this.clearOutputFile();

        if (this.viewedObject)
        {
            this.viewer.clear();
            this.viewedObject = null;
            if(this.onchange) this.onchange(this);
        }

        this.enableItems();
    },

    // aborts the build process and rendering
    //
    abort: function()
    {
        // abort if state is processing
        if(this.state == 1)
        {
            //todo: abort
            this.setStatus("Aborted <img id=busy src='Viewer/imgs/aborted.png'>");
            this.worker.terminate();
            this.state = 3; // incomplete
            this.enableItems();
            if(this.onchange) this.onchange(this);
        }
    },

    // controls the visibility of the elemnts created by createElements()
    //
    enableItems: function()
    {
        this.abortbutton.style.display = (this.state == 1) ? "inline-block":"none";
        this.formatDropdown.style.display = ((!this.hasOutputFile)&&(this.viewedObject))? "inline":"none";
        this.generateOutputFileButton.style.display = ((!this.hasOutputFile)&&(this.viewedObject))? "inline":"none";
        this.downloadOutputFileLink.style.display = this.hasOutputFile? "inline-block":"none";
        this.parametersdiv.style.display = (this.paramControls.length > 0)? "inline-block":"none";     // was 'block'
        this.errordiv.style.display = this.hasError? "block":"none";
        this.statusdiv.style.display = this.hasError? "none":"block";
        this.selectdiv.style.display = (this.currentObjects.length > 1) ? "inline-block":"inline-block"; // FIXME once there's a data model
    },

    // adds libraries to this.opts Object
    //
    addLibrary: function(lib)
    {
        this.opts['libraries'].push(lib);
    },

    // set Path for libraries
    //
    setOpenJsCadPath: function(path)
    {
        this.opts['openJsCadPath'] = path;
    },

    setError: function(txt)
    {
        this.hasError = (txt != "");
        this.errorpre.textContent = txt;
        this.enableItems();
    },

    //just sets the Status in the statusspan in statusdiv and logs via OpenJsCad.log
    //
    setStatus: function(txt)
    {
        if(typeof document !== 'undefined')
        {
            this.statusspan.innerHTML = txt;
            OpenJsCad.log(txt);
        }
        else
        {
            OpenJsCad.log(txt);
        }
    },

    //////////////////////////////////////////////////////
    //Setting up the Model and the Parameters starts here
    //
    //
    //
    //

    // script: javascript code
    // filename: optional, the name of the .jscad file
    //
    setJsCad: function(script, filename)
    {
        //check if file otherwise set to openjscad.jscad
        if(!filename) filename = "openjscad.jscad";

        //init everything needed
        this.abort();
        this.clearViewer();
        this.paramDefinitions = [];
        this.paramControls = [];
        this.script = null;
        this.setError("");
        var scripthaserrors = false;

        try
        {
            //get Parameters Definition in jscad file
            this.paramDefinitions = OpenJsCad.getParamDefinitions(script);

            //create the parameter Controls out of params[] array which is returned by getParamDefinitions() function
            //params[] array is pointing to this.paramDefinitions
            this.createParamControls();
        }
        catch(e)
        {
            this.setError(e.toString());
            this.setStatus("Error.");
            scripthaserrors = true;
        }

        if(!scripthaserrors)
        {
            // if everithing OK call function rebuildSolid()
            this.script = script;
            this.filename = filename;
            this.rebuildSolid();
        }
        else
        {
            this.enableItems();
            if(this.onchange) this.onchange();
        }
    },

    // Get the Parameter Values in the jsCad File
    //
    getParamValues: function()
    {
        var paramValues = {};

        //iterates through the paramControls Arry generated by createParamControls() function
        //
        for(var i = 0; i < this.paramControls.length; i++)
        {
            var control = this.paramControls[i];

            switch (control.paramType)
            {
                case 'choice':

                    paramValues[control.paramName] = control.options[control.selectedIndex].value;
                    break;

                case 'float':
                case 'number':

                    var value = control.value;

                    if (!isNaN(parseFloat(value)) && isFinite(value))
                    {
                        paramValues[control.paramName] = parseFloat(value);
                    }
                    else
                    {
                        throw new Error("Parameter ("+control.paramName+") is not a valid number ("+value+")");
                    }
                    break;

                case 'int':

                    var value = control.value;
                    if (!isNaN(parseFloat(value)) && isFinite(value))
                    {
                        paramValues[control.paramName] = parseInt(value);
                    }
                    else
                    {
                        throw new Error("Parameter ("+control.paramName+") is not a valid number ("+value+")");
                    }
                    break;

                case 'checkbox':
                case 'radio':

                    if (control.checked == true && control.value.length > 0)
                    {
                        paramValues[control.paramName] = control.value;
                    }
                    else
                    {
                        paramValues[control.paramName] = control.checked;
                    }
                    break;

                default:

                    paramValues[control.paramName] = control.value;
                    break;

            }
        }

        // retunrs the paramValues Object allen control Values
        return paramValues;
    },

    // adds something to the jsCad script and i dont know what it does
    //
    getFullScript: function()
    {
        var script = "";
        // add the file cache
        script += 'var gMemFs = [';

        if (typeof(gMemFs) == 'object')
        {
        var comma = '';

            for(var fn in gMemFs)
            {
                script += comma;
                script += JSON.stringify(gMemFs[fn]);
                comma = ',';
            }
        }

        script += '];\n';
        script += '\n';
        // add the main script
        script += this.script;
        return script;
    },

    // starts an worker Thread an rbuilds solid Asnyc
    //
    rebuildSolidAsync: function()
    {
        //get all Parameter Values stored in parameters Object with names from jsCad File
        var parameters = this.getParamValues();

        // returns jsCad Script with gMemFs?????
        var script     = this.getFullScript();

        //checks if multithreading worker is supported
        if(!window.Worker) throw new Error("Worker threads are unsupported.");

        // create the worker
        var that = this;
        that.state = 1; // processing
        that.worker = OpenJsCad.createJscadWorker( this.baseurl+this.filename, script,
            // handle the results
            function(err, objs)
            {
              that.worker = null;

              if(err)
              {
                that.setError(err);
                that.setStatus("Error ");
                that.state = 3; // incomplete
              }
              else
              {
                that.setCurrentObjects(objs);
                that.setStatus("Ready ");
                that.state = 2; // complete
              }

              that.enableItems();
            });


        // pass the libraries to the worker for import
        var libraries = this.opts.libraries.map( function(l) {return this.baseurl + this.opts.openJsCadPath + l;}, this);

        // start the worker
        that.worker.postMessage({cmd: "render", parameters: parameters, libraries: libraries});
        that.enableItems();
    },

    // rebuilds solid sync; everything in browser window tab is blocking until process finished
    //
    rebuildSolidSync: function()
    {
        var parameters = this.getParamValues();
        try
        {
            this.state = 1; // processing

            // calls jscad-function.js createJscadFunction() ==> returns the function with jsCad Script
            var func = OpenJsCad.createJscadFunction(this.baseurl+this.filename, this.script);
            var objs = func(parameters);
            this.setCurrentObjects(objs);
            this.setStatus("Ready ");
            this.state = 2; // complete
        }
        catch(err)
        {
            var errtxt = err.toString();
            if(err.stack) { errtxt += '\nStack trace:\n'+err.stack;}
            this.setError(errtxt);
            this.setStatus("Error ");
            this.state = 3; // incomplete
        }
        this.enableItems();
    },

    // rebuild Solid is triggered by setJsCad()
    // it also decides on bool if rebuild should be async or sync as entered in options
    //
    rebuildSolid: function()
    {
        // clear previous solid and settings
        this.abort();
        this.setError("");
        this.clearViewer();
        this.enableItems();
        this.setStatus("Rendering. Please wait <img id=busy src='Viewer/imgs/busy.gif'>");

        // rebuild the solid Async
        if (this.opts.useAsync)
        {
            try
            {
                this.rebuildSolidAsync();
                return;
            }
            catch(err)
            {
                if (! this.opts.useSync)
                {
                    var errtxt = err.toString();
                    if(err.stack) {errtxt += '\nStack trace:\n'+err.stack;}
                    this.setError(errtxt);
                    this.setStatus("Error ");
                    this.state = 3; // incomplete
                    this.enableItems();
                }
            }
        }
        //rebuild the solid Sync
        if (this.opts.useSync)
        {
            this.rebuildSolidSync();
        }
    },


    ///////////////////////////////////////////////////////////////////////
    //File Generation and download happen here
    //
    //
    //
    //
    clearOutputFile: function()
    {
        if(this.hasOutputFile)
        {
            this.hasOutputFile = false;

            if(this.outputFileDirEntry)
            {
                this.outputFileDirEntry.removeRecursively(function(){});
                this.outputFileDirEntry=null;
            }

            if(this.outputFileBlobUrl)
            {
                OpenJsCad.revokeBlobUrl(this.outputFileBlobUrl);
                this.outputFileBlobUrl = null;
            }

            this.enableItems();
        }
    },

    generateOutputFile: function()
    {
        this.clearOutputFile();

        if(this.viewedObject)
        {
            try
            {
                this.generateOutputFileFileSystem();
            }
            catch(e)
            {
                this.generateOutputFileBlobUrl();
            }

            if(this.ondownload) this.ondownload(this);
        }
    },

    currentObjectsToBlob: function()
    {
        var startpoint = this.selectStartPoint;
        var endpoint   = this.selectEndPoint;
        if (startpoint > endpoint) { startpoint = this.selectEndPoint; endpoint = this.selectStartPoint; };

        var objs = this.currentObjects.slice(startpoint,endpoint+1);

        return this.convertToBlob(objs,this.selectedFormat());
    },

    convertToBlob: function(objs,format)
    {
        var formatInfo = this.formatInfo(format);
        // review the given objects
        var i;
        var foundCSG = false;
        var foundCAG = false;

        for (i = 0; i < objs.length; i++ )
        {
            if (objs[i] instanceof CSG) { foundCSG = true; }
            if (objs[i] instanceof CAG) { foundCAG = true; }
        }

        // convert based on the given format
        foundCSG = foundCSG && formatInfo.convertCSG;
        foundCAG = foundCAG && formatInfo.convertCAG;

        if (foundCSG && foundCAG) { foundCAG = false; } // use 3D conversion

        var object = new CSG();
        if ( foundCSG == false ) { object = new CAG(); }

        for (i = 0; i < objs.length; i++ )
        {
            if (foundCSG == true && objs[i] instanceof CAG)
            {
                object = object.union(objs[i].extrude({offset: [0,0,0.1]})); // convert CAG to a thin solid CSG
                continue;
            }

            if (foundCAG == true && objs[i] instanceof CSG)
            {
                continue;
            }

            object = object.union(objs[i]);
        }

        var blob = null;

        switch(format)
        {

            case 'stla':

                blob = object.toStlString();
                //blob = object.fixTJunctions().toStlString();
                break;

            case 'stlb':

                //blob = this.viewedObject.fixTJunctions().toStlBinary();   // gives normal errors, but we keep it for now (fixTJunctions() needs debugging)
                blob = object.toStlBinary({webBlob: true});
                break;

            case 'amf':

                blob = object.toAMFString({producer: "OpenJSCAD.org " + OpenJsCad.version,date: new Date()});
                blob = new Blob([blob],{ type: formatInfo.mimetype });
                break;

            case 'x3d':

                blob = object.fixTJunctions().toX3D();
                break;

            case 'dxf':

                blob = object.toDxf();
                break;

            case 'svg':

                blob = object.toSvg();
                break;

            case 'jscad':

                blob = new Blob([this.script], {type: formatInfo.mimetype });
                break;

            case 'json':

                blob = object.toJSON();
                break;

            default:

                throw new Error("Not supported");

        }

        return blob;

    },

    supportedFormatsForCurrentObjects: function()
    {
        var startpoint = this.selectStartPoint;
        var endpoint   = this.selectEndPoint;
        if (startpoint > endpoint) { startpoint = this.selectEndPoint; endpoint = this.selectStartPoint; };

        var objs = this.currentObjects.slice(startpoint,endpoint+1);

        this.formatInfo("stla"); // make sure the formats are initialized

        var objectFormats = [];
        var i;
        var format;

        var foundCSG = false;
        var foundCAG = false;

        for (i = 0; i < objs.length; i++ )
        {
            if (objs[i] instanceof CSG) { foundCSG = true; }
            if (objs[i] instanceof CAG) { foundCAG = true; }
        }

        for (format in this.formats)
        {
            if (foundCSG && this.formats[format].convertCSG == true )
            {
                objectFormats[objectFormats.length] = format;
                continue; // only add once
            }

            if (foundCAG && this.formats[format].convertCAG == true )
            {
                objectFormats[objectFormats.length] = format;
            }
        }

        return objectFormats;
    },

    formatInfo: function(format)
    {

        if ( this.formats === null )
        {

            this.formats = {

                stla:  { displayName: "STL (ASCII)", extension: "stl", mimetype: "application/sla", convertCSG: true, convertCAG: false },
                stlb:  { displayName: "STL (Binary)", extension: "stl", mimetype: "application/sla", convertCSG: true, convertCAG: false },
                amf:   { displayName: "AMF (experimental)", extension: "amf", mimetype: "application/amf+xml", convertCSG: true, convertCAG: false },
                x3d:   { displayName: "X3D", extension: "x3d", mimetype: "model/x3d+xml", convertCSG: true, convertCAG: false },
                dxf:   { displayName: "DXF", extension: "dxf", mimetype: "application/dxf", convertCSG: false, convertCAG: true },
                jscad: { displayName: "JSCAD", extension: "jscad", mimetype: "application/javascript", convertCSG: true, convertCAG: true },
                svg:   { displayName: "SVG", extension: "svg", mimetype: "image/svg+xml", convertCSG: false, convertCAG: true },
            };
        }

        return this.formats[format];
    },

    downloadLinkTextForCurrentObject: function()
    {
        var ext = this.selectedFormatInfo().extension;
        return "Download " + ext.toUpperCase();
    },

    generateOutputFileBlobUrl: function()
    {
        if (OpenJsCad.isSafari())
        {
            //console.log("Trying download via DATA URI");
            // convert BLOB to DATA URI
            var blob = this.currentObjectsToBlob();
            var that = this;
            var reader = new FileReader();

            reader.onloadend = function() {

                if (reader.result)
                {
                    that.hasOutputFile = true;

                    that.downloadOutputFileLink.href = reader.result;
                    that.downloadOutputFileLink.innerHTML = that.downloadLinkTextForCurrentObject();

                    var ext = that.selectedFormatInfo().extension;
                    that.downloadOutputFileLink.setAttribute("download","openjscad."+ext);
                    that.downloadOutputFileLink.setAttribute("target", "_blank");

                    that.enableItems();
                }
            };
            reader.readAsDataURL(blob);

        }
        else
        {
            //console.log("Trying download via BLOB URL");
            // convert BLOB to BLOB URL (HTML5 Standard)
            var blob = this.currentObjectsToBlob();
            var windowURL=OpenJsCad.getWindowURL();

            this.outputFileBlobUrl = windowURL.createObjectURL(blob);
            if(!this.outputFileBlobUrl) throw new Error("createObjectURL() failed");

            this.hasOutputFile = true;

            this.downloadOutputFileLink.href = this.outputFileBlobUrl;
            this.downloadOutputFileLink.innerHTML = this.downloadLinkTextForCurrentObject();

            var ext = this.selectedFormatInfo().extension;
            this.downloadOutputFileLink.setAttribute("download", "openjscad."+ext);

            this.enableItems();
        }
    },

    generateOutputFileFileSystem: function()
    {
        var request = window.requestFileSystem || window.webkitRequestFileSystem;

        if(!request)
        {
            throw new Error("Your browser does not support the HTML5 FileSystem API. Please try the Chrome browser instead.");
        }

        //console.log("Trying download via FileSystem API");
        // create a random directory name:

        var extension = this.selectedFormatInfo().extension;
        var dirname = "OpenJsCadOutput1_"+parseInt(Math.random()*1000000000, 10)+"_"+extension;
        var filename = "output."+extension; // FIXME this should come from this.filename
        var that = this;

        request(TEMPORARY, 20*1024*1024, function(fs){

            fs.root.getDirectory(dirname, {create: true, exclusive: true}, function(dirEntry) {

                that.outputFileDirEntry = dirEntry; // save for later removal

                dirEntry.getFile(filename, {create: true, exclusive: true}, function(fileEntry) {

                    fileEntry.createWriter(function(fileWriter) {

                        fileWriter.onwriteend = function(e) {

                            that.hasOutputFile = true;
                            that.downloadOutputFileLink.href = fileEntry.toURL();
                            that.downloadOutputFileLink.type = that.selectedFormatInfo().mimetype;
                            that.downloadOutputFileLink.innerHTML = that.downloadLinkTextForCurrentObject();
                            that.downloadOutputFileLink.setAttribute("download", fileEntry.name);
                            that.enableItems();};

                        fileWriter.onerror = function(e) {throw new Error('Write failed: ' + e.toString());};
                        var blob = that.currentObjectsToBlob();
                        fileWriter.write(blob);

                    },

                  function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "createWriter");}

                );

              },

              function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getFile('"+filename+"')");}

            );

            },

          function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "getDirectory('"+dirname+"')");}

        );

        },

      function(fileerror){OpenJsCad.FileSystemApiErrorHandler(fileerror, "requestFileSystem");}

    );

    },

    ///////////////////////////////////////////////////////////
    // Control Creation for Parameters starts here
    //
    //
    //
    //
    createGroupControl: function(definition)
    {
        var control = document.createElement("title");
        control.paramName = definition.name;
        control.paramType = definition.type;

        if('caption' in definition)
        {
            control.text = definition.caption;
            control.className = 'caption';
        }
        else
        {
            control.text = definition.name;
        }

        return control;
    },

    createChoiceControl: function(definition)
    {

        if(!('values' in definition))
        {
            throw new Error("Definition of choice parameter ("+definition.name+") should include a 'values' parameter");
        }

        var control = document.createElement("select");
        control.paramName = definition.name;
        control.paramType = definition.type;
        var values = definition.values;
        var captions;
        if('captions' in definition)
        {
            captions = definition.captions;
            if(captions.length != values.length)
            {
                throw new Error("Definition of choice parameter ("+definition.name+") should have the same number of items for 'captions' and 'values'");
            }
        }
        else
        {
            captions = values;
        }

        var selectedindex = 0;

        for(var valueindex = 0; valueindex < values.length; valueindex++)
        {
            var option = document.createElement("option");
            option.value = values[valueindex];
            option.text = captions[valueindex];
            control.add(option);

            if('default' in definition)
            {
                if(definition["default"] == values[valueindex])
                {
                    selectedindex = valueindex;
                }
            }

            else if('initial' in definition)
            {
                if(definition.initial == values[valueindex])
                {
                    selectedindex = valueindex;
                }
            }
        }

        if(values.length > 0)
        {
            control.selectedIndex = selectedindex;
        }

        return control;
    },

    createControl: function(definition)
    {

        var control_list = [

            {type: "text"    , control: "text"    , required: ["index","type","name"], initial: ""},
            {type: "int"     , control: "number"  , required: ["index","type","name"], initial: 0},
            {type: "float"   , control: "number"  , required: ["index","type","name"], initial: 0.0},
            {type: "number"  , control: "number"  , required: ["index","type","name"], initial: 0.0},
            {type: "checkbox", control: "checkbox", required: ["index","type","name","checked"], initial: ""},
            {type: "radio"   , control: "radio"   , required: ["index","type","name","checked"], initial: ""},
            {type: "color"   , control: "color"   , required: ["index","type","name"], initial: "#000000"},
            {type: "date"    , control: "date"    , required: ["index","type","name"], initial: ""},
            {type: "email"   , control: "email"   , required: ["index","type","name"], initial: ""},
            {type: "password", control: "password", required: ["index","type","name"], initial: ""},
            {type: "url"     , control: "url"     , required: ["index","type","name"], initial: ""},
            {type: "slider"  , control: "range"   , required: ["index","type","name","min","max"], initial: 0, label: true},

        ];

        // check for required parameters

        if(!('type' in definition))
        {
            throw new Error("Parameter definition ("+definition.index+ ") must include a 'type' parameter");
        }

        var control = document.createElement("input");
        var i,j,c_type,p_name;

        for (i = 0; i < control_list.length; i++)
        {

            c_type = control_list[i];
            if (c_type.type == definition.type)
            {

                for (j = 0; j < c_type.required.length; j++)
                {

                    p_name = c_type.required[j];

                    if(p_name in definition)
                    {

                        if(p_name == "index") continue;

                        if(p_name == "type") continue;

                        if (p_name == "checked")
                        { // setAttribute() only accepts strings
                            control.checked = definition.checked;
                        }
                        else
                        {
                            control.setAttribute(p_name, definition[p_name]);
                        }

                    }
                    else
                    {
                        throw new Error("Parameter definition ("+definition.index+ ") must include a '"+p_name+"' parameter");
                    }

                }

                break;

            }

        }


        if (i == control_list.length)
        {
            throw new Error("Parameter definition ("+definition.index+ ") is not a valid 'type'");
        }

        // set the control type
        control.setAttribute("type", c_type.control);

        // set name and type for obtaining values
        control.paramName = definition.name;
        control.paramType = definition.type;

        // determine initial value of control
        if('initial' in definition)
        {
            control.value = definition.initial;
        }
        else if('default' in definition)
        {
            control.value = definition.default;
        }
        else
        {
            control.value = c_type.initial;
        }

        // set generic HTML attributes

        for (var property in definition)
        {
            if (definition.hasOwnProperty(property))
            {

                if (c_type.required.indexOf(property) < 0)
                {
                    control.setAttribute(property, definition[property]);
                }
            }
        }

        // add a label if necessary
        if('label' in c_type)
        {
            control.label = document.createElement("label");
            control.label.innerHTML = control.value;
        }

        return control;

    },

    // Creates the Parameter Controls for parametersdiv
    //
    createParamControls: function()
    {
        this.parameterstable.innerHTML = "";
        this.paramControls = [];


        for(var i = 0; i < this.paramDefinitions.length; i++)
        {
            var paramdef = this.paramDefinitions[i];
            paramdef.index = i+1;

            var control = null;
            var type = paramdef.type.toLowerCase();

            switch (type)
            {

                case 'choice':

                    control = this.createChoiceControl(paramdef);

                    break;

                case 'group':

                    control = this.createGroupControl(paramdef);

                    break;

                default:

                    control = this.createControl(paramdef);

                    break;

            }

            // add the appropriate element to the table
            var tr = document.createElement("tr");

            if(type == "group")
            {

                var th = document.createElement("th");
                if('className' in control)
                {
                    th.className = control.className;
                    th.colSpan = "2";
                }

                th.innerHTML = control.text;

                tr.appendChild(th);

            }
            else
            {

                // implementing instantUpdate
                var that = this;
                control.onchange = function(e) {

                    var l = e.currentTarget.nextElementSibling;

                    if(l !== null && l.nodeName == "LABEL")
                    {
                        l.innerHTML = e.currentTarget.value;
                    }

                    if(document.getElementById("instantUpdate").checked==true)
                    {
                        that.rebuildSolid();
                    }

                };


                this.paramControls.push(control);

                var td = document.createElement("td");
                var label = paramdef.name + ":";

                if('caption' in paramdef)
                {

                    label = paramdef.caption;
                    td.className = 'caption';
                }

                td.innerHTML = label;
                tr.appendChild(td);
                td = document.createElement("td");
                td.appendChild(control);

                if("label" in control)
                {
                    td.appendChild(control.label);
                }

                tr.appendChild(td);

            }

            this.parameterstable.appendChild(tr);

        }

    },



//End of Module
};

})(this);
