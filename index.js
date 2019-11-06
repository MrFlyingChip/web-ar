let surface, scene, camera, canvas;
let baggage = false;
const endScale = new THREE.Vector3(0.15, 0.15, 0.15);
let startTouches;

// Populates some object into an XR scene and sets the initial camera position.
const initXrScene = (e) => {
    scene = e.detail.scene;
    camera = e.detail.camera;
    canvas = e.detail.canvas;

    canvas.addEventListener('touchstart', recenterTouchHandler, true);  // Add touch listener.
    canvas.addEventListener('touchmove', touchMove, true);  // Add touch move listener.

    addFloor();
};

const addFloor = function () {
    let geometry = new THREE.PlaneGeometry( 1000, 1000, 1000 );
    let material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
    material.transparent = true;
    material.opacity = 0.4;
    surface = new THREE.Mesh(geometry, material);
    surface.position.y = -5;
    surface.rotation.x = -Math.PI / 2;
    scene.add(surface);
};

const recenterTouchHandler = (e) => {
    if (e.touches.length === 2) {
    } else if (e.touches.length === 1){
        if(baggage){
            startTouches = e.touches[0].clientX;
            return;
        }

       let intersects = createIntersectWithObject(surface, e);
        if(intersects.length > 0){
            placeBaggage(intersects);
        }
    }
};

const createIntersectWithObject = (object, event) => {
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    mouse.x = ( event.touches[0].clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.touches[0].clientY / window.innerHeight ) * 2 + 1;
    raycaster.setFromCamera( mouse, camera );
    return raycaster.intersectObject(surface);
};

const touchMove = (e) => {
    e.preventDefault();

    if (e.touches.length === 2) {
        rotateBaggage(e);
    } else if (e.touches.length === 1){
        if(!baggage){
            return;
        }

        let intersects = createIntersectWithObject(surface, e);
        if(intersects.length > 0){
            moveBaggage(intersects);
        }
    }
};

const rotateBaggage = (e) => {
    const rotation = (e.touches[0].clientX - startTouches) / 1000;
    baggage.rotateY(rotation);
};

const moveBaggage = (pickResult) => {
    baggage.position.x = pickResult[0].point.x;
    baggage.position.y = pickResult[0].point.y;
    baggage.position.z = pickResult[0].point.z;
};

const placeBaggage = (pickResult) => {
    baggage = true;
    let loader = new THREE.OBJLoader();
    loader.load(
        'baggage.obj',
        function (object) {
            object.position.x = pickResult[0].point.x;
            object.position.y = pickResult[0].point.y;
            object.position.z = pickResult[0].point.z;

            object.scale.x = endScale.x;
            object.scale.y = endScale.y;
            object.scale.z = endScale.z;

            let material = new THREE.MeshBasicMaterial( {color: 0x000000, side: THREE.FrontSide} );
            material.transparent = true;
            material.opacity = 0.3;
            for (let i = 0; i < object.children.length; i++){
                object.children[i].material = material;
            }

            scene.add(object);
            baggage = object;
        },
        function (xhr) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        function (error) {
            baggage = false;
            sendLog( 'An error happened' );
        }
    );
};

const startScene = () => {
    try {
        window.XRWEB.threeJS();
        window.addEventListener('XRStarted', initXrScene);
    } catch (e) {
        sendLog(e.message);
    }
};

const onxrloaded = () => {
    startScene();
};

const sendLog = function (log){
    const Http = new XMLHttpRequest();
    const url='https://192.168.0.105:8000/console?log=' + log;
    Http.open("GET", url);
    Http.send();
};

window.onload = onxrloaded;