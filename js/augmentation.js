var camera, scene;
var videoCamera, videoScene;
var videoTexture;
var renderer;

var video = document.getElementById('webcam');
var videoCanvas = document.getElementById('videoCanvas');
var videoCtx = videoCanvas.getContext('2d');

var augmentation;
var tagSize = 30;
var tagID = "tag_8";
var screenScale = 2;

var gameTexture;

function init() {
    scene = new THREE.Scene();

    augmentation = new THREE.Object3D();
    augmentation.matrixAutoUpdate = false;

    gameTexture = new THREE.Texture(document.getElementById('game-canvas'));
    gameTexture.minFilter = THREE.LinearFilter;
    gameTexture.magFilter = THREE.LinearFilter;

    var screen = new THREE.Mesh(
        new THREE.PlaneGeometry(screenScale*tagSize, screenScale*tagSize, 1, 1),
        new THREE.MeshBasicMaterial({map: gameTexture, overdraw: true, side:THREE.DoubleSide}));
    screen.position.x = tagSize/2;
    screen.position.y = tagSize/2;
    screen.rotation.x = Math.PI;
    augmentation.add(screen);
    scene.add(augmentation);

    var videoWidth = videoCanvas.width;
    var videoHeight = videoCanvas.height;

    camera = new THREE.Camera();
    var far = 1000;
    var near = 10;
    var m = Chilitags.getCameraMatrix();
    camera.projectionMatrix.set(
            2*m[0]/videoWidth,              0,        2*m[2]/videoWidth-1,  0,
            0, -2*m[4]/videoHeight,    -(2*m[5]/videoHeight-1),  0,
            0,              0, (far+near)/(far-near), -2*far*near/(far-near),
            0,              0,                     1,  0
            );
    scene.add(camera);

    videoScene = new THREE.Scene();
    videoCamera = new THREE.OrthographicCamera(-videoWidth/2, videoWidth/2, videoHeight/2, -videoHeight/2, 1, 1000);
    videoCamera.position.x = 0;
    videoCamera.position.y = 0;
    videoCamera.position.z = 0;
    videoCamera.lookAt({x:0, y:0, z:-50});

    videoTexture = new THREE.Texture(videoCanvas);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(videoWidth, videoHeight, 1, 1), new THREE.MeshBasicMaterial({map: videoTexture, overdraw: true, side:THREE.DoubleSide}));
    plane.position.x = 0;
    plane.position.y = 0;
    plane.position.z = -50;
    plane.material.depthTest = false;
    plane.material.depthWrite = false;
    videoScene.add(plane);
    videoScene.add(videoCamera);


    var hasCanvas = !! window.CanvasRenderingContext2D;
    var hasWebGL = ( function () { try {
            var canvas = document.createElement( 'canvas' );
            return !! window.WebGLRenderingContext && (
                canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) );
            } catch( e ) { return false; } } )();

    if (hasWebGL) {
        renderer = new THREE.WebGLRenderer({antialias: true});
    }
    else {
        renderer = new THREE.CanvasRenderer();
    }
    renderer.setSize(videoWidth, videoHeight);

    var threeRenderer = document.getElementById('threeRenderer');
    threeRenderer.appendChild(renderer.domElement);

    renderLoop();
}

var previousOrientation = 0;

function renderLoop() {
    //Work around Firefox's bug 879717
    var videoIsReady = false;
    while (!videoIsReady) {
        try {
            videoCtx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);
            videoIsReady = true;
        } catch (e) {
            if (e.name.indexOf("NS_ERROR_NOT_AVAILABLE") == -1) throw e;
        }
    }
    videoTexture.needsUpdate = true;

    var estimations = Chilitags.estimate(videoCanvas, false);
    if ("tag_8" in estimations) {
        augmentation.updateMatrix();
        augmentation.matrix.set.apply(augmentation.matrix, estimations["tag_8"]);

        var eulerX = new THREE.Euler().setFromRotationMatrix(augmentation.matrix);
        eulerX.reorder('XYZ');
        //console.log(eulerX.x);
        var eulerY = new THREE.Euler().setFromRotationMatrix(augmentation.matrix);
        eulerY.reorder('YXZ');
        //console.log(eulerY.y);
        var TILTED_THRESHOLD = .5;
             if (eulerX.x < -TILTED_THRESHOLD) orientation = 0;
        else if (eulerX.x >  TILTED_THRESHOLD) orientation = 2;
        else if (eulerY.y >  TILTED_THRESHOLD) orientation = 3;
        else if (eulerY.y < -TILTED_THRESHOLD) orientation = 1;
        else                                   orientation = -1;

        //console.log(orientation+"+"+previousOrientation);
        if (previousOrientation == -1 || orientation == -1) {
            previousOrientation = orientation;
            if (orientation != -1) {
                //console.log(orientation)
                dirtyHack.emit("move", orientation);
            }
        }
        
    }

    html2canvas(document.getElementById('game-dom'), {
        onrendered: function(canvas) {
            var gameCanvas = document.getElementById('game-canvas')
            gameCanvas.width = canvas.width;
            gameCanvas.height = canvas.height;
            gameCanvas.getContext('2d').drawImage(canvas, 0, 0);
            gameTexture.needsUpdate = true;

            renderer.autoClear = false;
            renderer.clear();
            renderer.render(videoScene, videoCamera);
            renderer.render(scene, camera);
        }
    });

    requestAnimationFrame( renderLoop );
}

window.URL = window.URL || window.webkitURL;
navigator.getUserMedia  = navigator.getUserMedia
|| navigator.webkitGetUserMedia
|| navigator.mozGetUserMedia
|| navigator.msGetUserMedia;

navigator.getUserMedia({video: true}, function(stream) {
        video.src = window.URL.createObjectURL(stream);
        localMediaStream = stream;
        video.play();
        }, function() {alert('Failed to open video.')});

//the timeOut is a work around Firefox's bug 879717
video.addEventListener('play', function() {setTimeout(init, 2500);}, false);
