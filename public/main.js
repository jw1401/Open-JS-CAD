var gProcessor = null;        // required by OpenJScad.org

//var gComponents = [ { file: '../examples/box.jscad' } ];
var gComponents = [ { file: '../examples/frog-OwenCollins.stl' } ];

function loadProcessor()
{
      gProcessor = new OpenJsCad.Processor(document.getElementById("viewerContext"),
                                           {
                                                viewerwidth: '100%',
                                                viewerheight: '100%',
                                                drawLines: false,
                                                drawFaces: true,
                                            });


      loadJSCAD(0);

      OpenJsCad.env();
      OpenJsCad.AlertUserOfUncaughtExceptions();

      $('#toggleLines').on("click", function(){
        //console.log("toggle-lines");
        gProcessor.toggleDrawOption('lines');

      });

      $('#toggleFaces').on("click", function(){
        //console.log("toggleFaces");

        gProcessor.toggleDrawOption('faces');
      });

      $('#draggable-update-div').draggable();

      $('#showToolbar').on("click",function(){
        //console.log($('#updatediv').is(':visible'));
        if($('#draggable-update-div').is(':visible'))
        {
          $('#draggable-update-div').hide();
        }
        else $('#draggable-update-div').show();
      });

      resize();
      $(window).resize(function(){resize();});

      $('#parametersdiv').perfectScrollbar();
}



function loadJSCAD(choice)
{
      var filepath = gComponents[choice].file;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", filepath, true);

      gProcessor.setStatus("Loading "+filepath+" <img id=busy src='Viewer/imgs/busy.gif'>");

      xhr.overrideMimeType("text/plain; charset=x-user-defined");

      xhr.onload = function()
      {
        var source = this.responseText;

        if(filepath.match(/\.jscad$/i)||filepath.match(/\.js$/i))
        {
          gProcessor.setOpenJsCadPath('Viewer/js/');// set for library path
          gProcessor.setStatus("Processing "+filepath+" <img id=busy src='Viewer/imgs/busy.gif'>");
          gProcessor.setJsCad(source,filepath);
        }
        else
        {
          var worker = OpenJsCad.createConversionWorker();

          gProcessor.setStatus("Converting "+filepath+" <img id=busy src='Viewer/imgs/busy.gif'>");
          var u = gProcessor.baseurl +'Viewer/js/';

          //note: cache: false is set to allow evaluation of 'include' statements
          worker.postMessage({baseurl: u, source: source, filename: filepath, cache: false});
        }

      }
      xhr.send();
}

function resize()
{
  var height = $('#columnBig').height();
  //console.log(height);
  $('#columnSmall').height(height);
  //console.log($('#columnSmall').height());
}
