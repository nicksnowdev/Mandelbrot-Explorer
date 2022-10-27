/// <reference path="C:/Users/nicsn/projects/resources/p5_definitions/global.d.ts" />

// parameters to be controlled
const controls = {
  "iterations": 0,
  "zoom": 1,
  "panX": .5,
  "panY": 0,
  "resolution": 1,
  "basePrecision": .16,
  "bg": "#000000",
  "fast": "#0000ff",
  "medium": "#ff0000",
  "slow": "#ffff00",
  "contained": "#ffffff",
  "bw": true
}
let paused = false;
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

  const tab = pane.addTab({
    pages: [
      {title: 'Render'},
      {title: 'Style'},
    ]
  });

  // main controls
  tab.pages[0].addInput(controls, "resolution", {label: "resolution", min: 0, max: 1, step: .1});
  precisionSlider = tab.pages[0].addInput(controls, "basePrecision", {label: "precision", min: .1, max: 1, step: .01});
  tab.pages[0].addSeparator();
  tab.pages[0].addButton({title: "reset pan and zoom"}).on("click", () => goto(.5, 0, 1, .16));
  
  tab.pages[1].addInput(controls, "contained", {label: "contained",  view: "color"});
  tab.pages[1].addInput(controls, "slow", {label: "slow",  view: "color"});
  tab.pages[1].addInput(controls, "medium", {label: "medium", view: "color"});
  tab.pages[1].addInput(controls, "fast", {label: "fast", view: "color"});
  tab.pages[1].addInput(controls, "bg", {label: "background", view: "color"});
  tab.pages[1].addSeparator();
  tab.pages[1].addInput(controls, "bw", {label: "grayscale"});

  // initialize the ranges and draw the first plot
  setRedraw();
}




function draw() {
  // only draw if something was updated
  if(redraw) {
    let col;
    let bg = color(controls.bg);
    let fast = color(controls.fast);
    let medium = color(controls.medium);
    let slow = color(controls.slow);
    let contained = color(controls.contained);

    if(resumeX == 0 && resumeY == 0) {
      background(0); // only clear at the very beginning in case it takes multiple frames to draw
      print(locate()); // log current settings
    }
    // process each pixel
    loadPixels();
    let pixelScale = round(map(1 - controls.resolution, 0, 1, 1, 10)); // convert rez to pixel size
    let x;
    let y;
    let t0 = performance.now();;
    let t1;
    let n = controls.iterations;
    let shade;
    let red;
    let green;
    let blue;
    let gray = controls.bw;
    for(y = resumeY; y <= height - pixelScale; y += pixelScale) {
      for(x = resumeX; x <= width - pixelScale; x += pixelScale) {
        // initialize
        let a = map(x, 0, width, -xRange, xRange) - controls.panX;
        let b = map(y, 0, height, -yRange, yRange) - controls.panY;
        let cR = a;
        let cI = b;
        let time = 0; // track how fast a point diverges

        // iterate
        for(let i = 1; i <= n; i++) {
          let aa = a*a - b*b + cR;
          let bb = 2*a*b + cI;
          a = aa;
          b = bb;

          // see if it is escaping
          if(a*a + b*b > 4) {
            time = i;
            break; // exit early if possible
          }
        }

        if(gray) {
          shade = time / n;
          red = 255 * shade;
          green = 255 * shade;
          blue = 255 * shade;
        }
        else {
          shade = 3 * time / n;
          // if it converges, shade black or white
          if(time == 0) {
            col = contained;
          }
          // if it diverges quickly
          else if(shade < 1) {
            col = lerpColor(bg, fast, shade);
          }
          // if it diverges at a medium pace
          else if(shade < 2) {
            col = lerpColor(fast, medium, shade - 1);
          }
          // if it diverges slowly
          else {
            col = lerpColor(medium, slow, shade - 2);
          }

          red = col._array[0] * 255;
          green = col._array[1] * 255;
          blue = col._array[2] * 255;
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
}