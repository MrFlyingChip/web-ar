let XRWEB = function (){
    let eventPermissions = [{event: DeviceMotionEvent, name: "devicemotion", func: handleDeviceMotion},
        {event: DeviceOrientationEvent, name: "deviceorientation", func: handleOrientation},
        {event: DeviceOrientationEvent, name: "orientationchange", func: handleScreenOrientation}];

    let currentDeviceMotion = {deviceOrientation: {}, screenOrientation: 0, alphaOffset: 0};
    let startEvent;

    this.threeJS = function () {
        let camera,  scene, renderer;

        function update() {
            if (!currentDeviceMotion.enabled) return;
            const device = currentDeviceMotion.deviceOrientation;
            if (device) {
                const alpha = device.alpha ? THREE.Math.degToRad( device.alpha ) + currentDeviceMotion.alphaOffset : 0; // Z
                const beta = device.beta ? THREE.Math.degToRad( device.beta ) : 0; // X'
                const gamma = device.gamma ? THREE.Math.degToRad( device.gamma ) : 0; // Y''
                const orient = currentDeviceMotion.screenOrientation ? THREE.Math.degToRad( currentDeviceMotion.screenOrientation ) : 0; // O
                setObjectQuaternion(camera.quaternion, alpha, beta, gamma, orient);
            }
        }

        const setObjectQuaternion = function () {
            var zee = new THREE.Vector3( 0, 0, 1 );
            var euler = new THREE.Euler();
            var q0 = new THREE.Quaternion();
            var q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis
            return function ( quaternion, alpha, beta, gamma, orient ) {
                euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us
                quaternion.setFromEuler( euler ); // orient the device
                quaternion.multiply( q1 ); // camera looks out the back of the device, not the top
                quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation
            };
        }();

        function init(){
            camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1100 );
            scene = new THREE.Scene();
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor( 0xffffff, 0);
            document.body.appendChild(renderer.domElement);
            window.addEventListener('resize', onWindowResize, false);
            runXR(renderer.domElement, scene, camera);
            handleScreenOrientation();
            camera.rotation.reorder( 'YXZ' );

            let light = new THREE.AmbientLight( 0x404040 ); // soft white light
            scene.add( light );
        }

        function animate(){
            window.requestAnimationFrame(animate);
            update();
            renderer.render( scene, camera );
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize( window.innerWidth, window.innerHeight );
        }

        init();
        animate();
    };

    function runXR(canvas, scene, camera){
        startEvent = new CustomEvent('XRStarted', {'detail': {'scene': scene, 'camera': camera, 'canvas': canvas}});

        navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}})
            .then(mediaStream => {
                createVideoElement(mediaStream, canvas);
                requestPermissions();
            });
    }

    function createVideoElement(mediaStream, canvas){
        let video = document.createElement("video");
        video.style = "position: absolute; width: auto; height:auto;z-index: -100;min-width: 100%; min-height: 100%;";
        video.autoplay = true;
        video.playsInline = true;
        canvas.style.position = "relative";
        document.body.insertBefore(video, canvas);
        video.srcObject = mediaStream;
    }

    function requestPermission(event) {
        return new Promise(function (permission) {
            event && event.requestPermission ?
                event.requestPermission()
                    .then(permission)
                    .catch(function (error) {
                        sendLog(error);
                        permission("retry")
                    })
                : permission("granted")
        });
    }

    function requestPermissions() {

        let permissionsPromises = eventPermissions.map(permission => {
            if(!permission.status || permission.status === "retry"){
                let perm = requestPermission(permission.event);
                return perm && perm.then(value => {
                    permission.status = value;
                    return permission;
                })
            }
        });

        Promise.all(permissionsPromises).then(value => {
            value.forEach(permission => {
                if(permission.status === "granted"){
                    if(!permission.granted){
                        permission.granted = "added";
                        window.addEventListener(permission.name, permission.func, false);
                    }
                }
            });

            let canLaunchXR = true;
            value.forEach(permission => {
                if(!permission.granted || permission.granted !== "added"){
                    canLaunchXR = false;
                }
            });

            if(canLaunchXR){
                window.dispatchEvent(startEvent);
            }

            return value.find(permission => {
                return "granted" !== permission.status
            }) || {status: "granted"};
        }).then(permission => {
            if ("granted" !== permission.status) {
                if ("retry" !== permission.status) {
                   //TODO: show error on screen
                    sendLog("Denied");
                } else {
                    sendLog("Retry");
                    showPermissionPrompt()
                        .then(value => {
                            requestPermissions();
                        })
                        .catch(error => {
                            permission.status = error.status;
                        })
                }
            }
        });
    }

    function handleOrientation(event){
        currentDeviceMotion.enabled = true;

        currentDeviceMotion.deviceOrientation = event;
    }

    function handleScreenOrientation() {
       currentDeviceMotion.screenOrientation = window.orientation  || 0;
    }

    function handleDeviceMotion(event) {

    }

    function showPermissionPrompt() {
        let styleWasDefined = false;
        if (!styleWasDefined) {
            styleWasDefined = true;
            let style = document.createElement("style");
            style.textContent = "\n    .prompt-box-8w {\n      font-family: 'Nunito', 'Nunito Regular', 'Varela-Round', sans-serif;\n      position: fixed;\n      left: 50%;\n      top: 50%;\n      transform: translate(-50%, -50%);\n      width: 90vmin;\n      width: 15em;\n      max-width: 100%;\n      font-size: 20px;\n      z-index: 888;\n      background-color: white;\n      filter: drop-shadow(0 0 3px #0008);\n      overflow: hidden;\n      border-radius: 0.5em;\n      padding: 0.5em;\n      color: #323232;\n    }\n\n    .prompt-box-8w * {\n      font-family: inherit;\n    }\n\n    .prompt-box-8w p {\n      margin: 0.5em 0.5em 1em;\n    }\n\n    .prompt-button-container-8w {\n      display: flex;\n    }\n\n    .prompt-button-8w {\n      flex: 1 0 0;\n      min-width: 5em;\n      text-align: center;\n      color: white;\n      background-color: #818199;\n      font-size: inherit;\n      font-family: inherit;\n      display: block;\n      outline: none;\n      border: none;\n      margin: 0;\n      border-radius: 0.25em;\n      padding: 0.37em;\n    }\n\n    .prompt-button-8w:not(:last-child) {\n      margin-right: 0.5em;\n    }\n\n    .button-primary-8w {\n      background-color: #7611B7;\n    }\n  ";
            document.head.prepend(style);
        }

        let dialogWindow = document.createElement("div");
        dialogWindow.classList.add("prompt-box-8w");
        let text = document.createElement("p");
        text.textContent = "AR requires access to your sensors. Press continue to allow.";
        dialogWindow.appendChild(text);
        let buttonContainer = document.createElement("div");
        buttonContainer.classList.add("prompt-button-container-8w");
        let cancelButton = document.createElement("button");
        cancelButton.classList.add("prompt-button-8w");
        cancelButton.textContent = "Cancel";
        buttonContainer.appendChild(cancelButton);
        let continueButton = document.createElement("button");
        continueButton.classList.add("prompt-button-8w", "button-primary-8w");
        continueButton.textContent = "Continue";
        buttonContainer.appendChild(continueButton);
        dialogWindow.appendChild(buttonContainer);
        document.body.appendChild(dialogWindow);
        return new Promise(function (onSuccess, onDenied) {
            cancelButton.addEventListener("click", function () {
                document.body.removeChild(dialogWindow);
                onDenied({type: "permission", permission: "prompt", status: "denied"});
            }, {once: !0});
            continueButton.addEventListener("click", function () {
                document.body.removeChild(dialogWindow);
                onSuccess();
            }, {once: !0});
        })
    }

     function sendLog(log){
        const Http = new XMLHttpRequest();
        const url='https://192.168.0.105:8000/console?log=' + log;
        Http.open("GET", url);
        Http.send();
    }
};

window.XRWEB = new XRWEB();

