/// <reference path="C:/Users/nicsn/projects/resources/p5_definitions/global.d.ts" />

// parameters to be controlled
const controls = {
  "iterations": 0,
  "zoom": 1,
  "panX": .5,
  "panY": 0,
  "pixelScale": 1,
  "basePrecision": .16,
  "convergeColor": true
}
let paused = false;
let fpsGraph;
let pane;
let precisionSlider;
let canvas;

let xRange;
let yRange;
let redraw = true;
let panAllowed = true;

//keep track of iterations over multiple frames
let resumeX = 0;
let resumeY = 0;


// called whenever the window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setRedraw();
}

function locate() {
  return [controls.panX, controls.panY, controls.zoom, controls.basePrecision];
}

function goto(x, y, zoom, precision) {
  controls.panX = x;
  controls.panY = y;
  controls.zoom = zoom;
  controls.basePrecision = precision;
  precisionSlider.value = precision;
  pane.refresh();
  setRedraw();
}

function adaptIter() {
  controls.iterations = (1000 ** controls.basePrecision - 1.5) * log(controls.zoom + 1000) ** 2;
}

// called whenever a control is changed
function setRedraw() {
  redraw = true;
  resumeX = 0;
  resumeY = 0;
  // set the ranges here in case zoom was changed
  xRange = 3 / controls.zoom;
  yRange = height / width * xRange;
  adaptIter();
}

function noPan() {
  panAllowed = false;
}
function yesPan() {
  panAllowed = true;
}

// allow user to pan by dragging the mouse
function mouseDragged() {
  if(panAllowed) {
    controls.panX += map(mouseX - pmouseX, -width / 2, width / 2, -xRange, xRange);
    controls.panY += map(mouseY - pmouseY, -height / 2, height / 2, -yRange, yRange);
    setRedraw();
  }
}

// zoom centers on mouse
function zoomControl(event) {
  let oldZoom = controls.zoom;
  controls.zoom -= min(max(event.deltaY, -50), 50) * .005 * controls.zoom;
  controls.zoom = min(max(1, controls.zoom), 100000000000000);
  if(oldZoom != controls.zoom) { // prevent refreshing image when trying to zoom beyond max
    controls.panX += map(mouseX, 0, width, -xRange, xRange) * (oldZoom - controls.zoom) / controls.zoom;
    controls.panY += map(mouseY, 0, height, -yRange, yRange) * (oldZoom - controls.zoom) / controls.zoom;
    adaptIter();
    setRedraw();
  }
}




function setup() {
  // set up canvases
  pixelDensity(1); // account for high-density displays
  canvas = createCanvas(windowWidth, windowHeight); // 2D mode
  canvas.mouseWheel(zoomControl) // enable zooming function
  canvas.mouseOver(yesPan);
  canvas.mouseOut(noPan);
  background(0); // initialize

  // set up gui
  // define where the control panel should go
  const controlsContainer = createDiv();
  controlsContainer.id("controlsContainer");
  controlsContainer.style("position", "fixed"); // always visible, even when scrolling
  controlsContainer.style("top", "10px");
  controlsContainer.style("right", "10px"); // left or right
  controlsContainer.style("width", "260px");
  // create a pane as a child of the previously created div
  pane = new Tweakpane.Pane({container: document.getElementById("controlsContainer"), title: "controls", expanded: true});
  pane.on("change", () => setRedraw());
  pane.registerPlugin(TweakpaneEssentialsPlugin); // add plugin for fpsgraph
  pane.addSeparator();

  // main controls
  pane.addInput(controls, "pixelScale", {label: "pixel size", min: 1, max: 8, step: 1});
  precisionSlider = pane.addInput(controls, "basePrecision", {label: "precision", min: .1, max: 1, step: .01});
  pane.addInput(controls, "convergeColor", {label: "white"});

  pane.addSeparator();
  pane.addButton({title: "reset"}).on("click", () => goto(.5, 0, 1, .16));
  pane.addSeparator();
  
  const stats = pane.addFolder({title: "stats", expanded: false});
  fpsGraph = stats.addBlade({view: "fpsgraph", label: "fps"});

  // initialize the ranges and draw the first plot
  setRedraw();
}




function draw() {
  fpsGraph.begin();

  // only draw if something was updated
  if(redraw) {
    if(resumeX == 0 && resumeY == 0) {
      background(0); // only clear at the very beginning in case it takes multiple frames to draw
      print(locate()); // log current settings
    }
    // process each pixel
    loadPixels();
    let pixelScale = controls.pixelScale; // get this into its own variable
    let x;
    let y;
    let t0 = performance.now();;
    let t1;
    for(y = resumeY; y <= height - pixelScale; y += pixelScale) {
      for(x = resumeX; x <= width - pixelScale; x += pixelScale) {
        // initialize
        let a = map(x, 0, width, -xRange, xRange) - controls.panX;
        let b = map(y, 0, height, -yRange, yRange) - controls.panY;
        let cR = a;
        let cI = b;

        let n = controls.iterations;
        let time = 0; // track how fast a point diverges

        // iterate
        for(let i = 1; i <= n; i++) {
          let aa = a*a - b*b + cR;
          let bb = 2*a*b + cI;
          a = aa;
          b = bb;

          // see if it is escaping
          if(a*a + b*b > 4 && time == 0) {
            time = i;
            break; // exit early if possible
          }
        }

        let red;
        let green;
        let blue;
        let shade = 3 * time / n;
        let converge = 255 * controls.convergeColor; // color of set members
        // if it converges, shade black or white
        if(time == 0) {
          red = converge;
          green = converge;
          blue = converge;
        }
        // if it diverges quickly, shade blue
        else if(shade < 1) {
          red = 0;
          green = 0;
          blue = 255 * shade;
        }
        // if it diverges at a medium pace, shade red
        else if(shade < 2) {
          red = 255 * (shade - 1);
          green = 0;
          blue = 255 * (1 - (shade - 1));
        }
        // if it diverges slowly, shade yellow
        else {
          red = 255;
          green = 255 * (shade - 2);
          blue = 0;
        }

        for(let i = 0; i < pixelScale; i++) {
          for(let j = 0; j < pixelScale; j++) {
            let pix = (x + i + (y + j) * width) * 4; // account for 4 channels per pixel
            pixels[pix + 0] = red;
            pixels[pix + 1] = green;
            pixels[pix + 2] = blue;
            pixels[pix + 3] = 255;
          }
        }
      }
      t1 = performance.now();
      if(t1 - t0 > 500) {
        if(x >= width - pixelScale) x = 0;
        resumeX = x ;
        resumeY = y + pixelScale;
        break;
      }
    }
    updatePixels();
    if(y > height - pixelScale && x > width - pixelScale) redraw = false;
    else {
      stroke(0, 255, 0);
      line(0, y + pixelScale * 2, width, y + pixelScale * 2);
    }
  }

  fpsGraph.end();
}