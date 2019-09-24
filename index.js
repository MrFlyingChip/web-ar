let surface, engine, scene, camera;
let baggage;
const endScale = new BABYLON.Vector3(0.08, 0.08, 0.08) ;
let startTouches;

// Populates some object into an XR scene and sets the initial camera position.
const initXrScene = ({ scene, camera }) => {

    const directionalLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0, -1, 1), scene);
    directionalLight.intensity = 1.0;

    // Set the initial camera position relative to the scene we just laid out. This must be at a
    // height greater than y=0.
    camera.position = new BABYLON.Vector3(0, 3, 5);

    const ground = BABYLON.Mesh.CreatePlane('ground', 100, scene);
    ground.rotation.x = Math.PI / 2;
    ground.material = new BABYLON.StandardMaterial("groundMaterial", scene);
    ground.material.alpha = 0;
    surface = ground;
};

const recenterTouchHandler = (e) => {
    // Call XrController.recenter() when the canvas is tapped with two fingers. This resets the
    // AR camera to the position specified by XrController.updateCameraProjectionMatrix() above.
    if (e.touches.length === 2) {
    } else if (e.touches.length === 1){
        if(baggage){
            startTouches = e.touches[0].clientX;
            return;
        }

        const pickResult = scene.pick(e.touches[0].clientX, e.touches[0].clientY);
        if(pickResult.hit && pickResult.pickedMesh === surface){
            placeBaggage(pickResult);
        }
    }
};

const touchMove = (e) => {
    e.preventDefault();

    if (e.touches.length === 2) {
        rotateBaggage(e);
    } else if (e.touches.length === 1){
        if(!baggage){
            return;
        }

        const pickResult = scene.pick(e.touches[0].clientX, e.touches[0].clientY);
        if(pickResult.hit && pickResult.pickedMesh === surface){
            moveBaggage(pickResult);
        }
    }
};

const rotateBaggage = (e) => {
    const rotation = (e.touches[0].clientX - startTouches) / 1000;
    for (i = 0; i < baggage.meshes.length; i++) {
        baggage.meshes[i].addRotation(0, rotation, 0)
    }
};

const moveBaggage = (pickResult) => {
    for (i = 0; i < baggage.meshes.length; i++) {
        baggage.meshes[i]._position.x = pickResult.pickedPoint.x;
        baggage.meshes[i]._position.y = pickResult.pickedPoint.y;
        baggage.meshes[i]._position.z = pickResult.pickedPoint.z;
    }
};

const placeBaggage = (pickResult) => {
    const gltf = BABYLON.SceneLoader.LoadAssetContainer(
        './',
        'baggage.obj',
        scene,
        function (container) {  // onSuccess
            // Adds all elements to the scene
            baggage = container;
            var myMaterial = new BABYLON.StandardMaterial("myMaterial", scene);
            myMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            myMaterial.alpha = 0.4;
            for (i = 0; i < baggage.meshes.length; i++) {
                baggage.meshes[i].material = myMaterial;
                baggage.meshes[i]._position.x = pickResult.pickedPoint.x;
                baggage.meshes[i]._position.y = pickResult.pickedPoint.y - 0.5;
                baggage.meshes[i]._position.z = pickResult.pickedPoint.z;
                baggage.meshes[i]._scaling.x = endScale.x;
                baggage.meshes[i]._scaling.y = endScale.y;
                baggage.meshes[i]._scaling.z = endScale.z;
            }

            baggage.addAllToScene();
        },
        function (xhr) { //onProgress
            console.log(`${(xhr.loaded / xhr.total * 100 )}% loaded`);
        },
        function (error) { //onError
            console.log('Error loading model');
        },
    )
};


const startScene = () => {
    console.log("startScene");
    const canvas = document.getElementById('renderCanvas');

    engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
    engine.enableOfflineSupport = false;

    scene = new BABYLON.Scene(engine);
    camera = new BABYLON.DeviceOrientationCamera('camera', new BABYLON.Vector3(0, 0, 0), scene);

    initXrScene({ scene, camera }); // Add objects to the scene and set starting camera position.

    // Connect the camera to the XR engine and show camera feed
    //camera.addBehavior(XR.Babylonjs.xrCameraBehavior());

    canvas.addEventListener('touchstart', recenterTouchHandler, true);  // Add touch listener.
    canvas.addEventListener('touchmove', touchMove, true);  // Add touch move listener.

    engine.runRenderLoop(() => {
        // Render scene
        scene.render();
    });

    window.addEventListener('resize', () => {
        engine.resize();
    })
};

const onxrloaded = () => {
    startScene();
};

// Show loading screen before the full XR library has been loaded.
window.onload = onxrloaded;
