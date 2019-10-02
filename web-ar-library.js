window.XR = new XRWEB();

function XRWEB (){
    let eventPermissions = [{event: DeviceMotionEvent, name: "devicemotion", func: handleDeviceMotion},
        {event: DeviceOrientationEvent, name: "deviceorientation", func: handleOrientation}];

    let updateId;
    let currentDeviceMotion = {orientation: {}, rotationRate: {}, acceleration: {}, accelerationIncludingGravity: {}};
    let updateEvent;
    let startEvent;

    this.babylonXR = function () {
        let engineCamera;
        let engineScene;
        let engine;
        let engineCanvas;

        function onStart(){
            setInterval(() => {
                if(!currentDeviceMotion.currentRotation || !currentDeviceMotion.currentRotation.x){
                    return;
                }
                //sendLog("Current position: x: " + convertAngleOpposite(engineCamera.position.x) + " y: " + convertAngleOpposite(engineCamera.position.y) + " z: " + convertAngleOpposite(engineCamera.position.z));
                //sendLog("Current rotation: x: " + convertAngleOpposite(engineCamera.rotation.x) + " y: " + convertAngleOpposite(engineCamera.rotation.y) + " z: " + convertAngleOpposite(engineCamera.rotation.z));
                //sendLog("x: " + currentDeviceMotion.acceleration.x + " y: " + currentDeviceMotion.acceleration.y + " z: " + currentDeviceMotion.acceleration.z);
            }, 1000);

            engineCamera.noRotationConstraint = true;
            engineCamera.updateUpVectorFromRotation = true;

            engineCamera.rotationQuaternion = translateRotation(engineCamera.rotationQuaternion);
        }

        function onUpdate() {
            if(currentDeviceMotion.currentRotation){
                engineCamera.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(currentDeviceMotion.currentRotation.x,
                    currentDeviceMotion.currentRotation.y, currentDeviceMotion.currentRotation.z);
            }

            if(currentDeviceMotion.acceleration){
                let position = engineCamera.globalPosition;
                position.x += currentDeviceMotion.acceleration.x;
                position.y += currentDeviceMotion.acceleration.y;
                position.z += currentDeviceMotion.acceleration.z;
            }

            engineCamera.computeWorldMatrix();
        }

        function translateRotation(startRotation){
            let result = new BABYLON.Quaternion;
            if(scene.useRightHandedSystem){
                let tempVector = new BABYLON.Vector3;
                result.copyFrom(startRotation);
                result.toEulerAnglesToRef(tempVector);
                tempVector.x *= -1;
                tempVector.z *= -1;
                BABYLON.Quaternion.FromEulerVectorToRef(tempVector, result);
            } else {
                result.x = startRotation.x;
                result.w = startRotation.w;
                result.y = startRotation.y;
                result.z = startRotation.z;
            }

            return result;
        }

        function translatePosition(startPosition) {
            let result = new BABYLON.Vector3;
            if(scene.useRightHandedSystem){
               result.x = -startPosition.x;
               result.y = startPosition.y;
               result.z = -startPosition.z;
            } else {
                result.x = startPosition.x;
                result.y = startPosition.y;
                result.z = startPosition.z;
            }

            return result;
        }

        return {
            xrCameraBehavior : function() {
                return {
                    name: "xrCameraBehavior",
                    attach: function(camera) {
                        engineCamera = camera;
                        engineCamera.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(engineCamera.rotation);
                        engine = camera.getEngine();
                        engineScene = camera.getScene();
                        engineCanvas = engine.getRenderingCanvas();

                        engineCamera.inertia = 0.2;

                        runXR(engineCanvas);
                        window.addEventListener("onStart", onStart);
                        window.addEventListener("onUpdate", onUpdate);
                    },
                    init: function() {},
                    detach: function() {}
                }
            }
        }
    };

    function runXR(canvas){
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
        //video.srcObject = mediaStream;
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
                tryLaunchXR();
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

    function tryLaunchXR(){
        updateEvent = new CustomEvent("onUpdate");
        startEvent = new CustomEvent("onStart");

        start();
        updateId = setInterval(update, 17);
    }

    function stopXR(){
        clearInterval(updateId);
    }

    function start(){
        window.dispatchEvent(startEvent);
    }

    function update() {
        currentDeviceMotion.interval = 0;
        if(currentDeviceMotion.rotationRate){
            calculateRotation();
        }

        window.dispatchEvent(updateEvent);

        calculateMoving();
    }

    function calculateRotation() {
        if(!currentDeviceMotion.currentRotation){
            if(currentDeviceMotion.orientation.beta){
                currentDeviceMotion.currentRotation = {
                    x: convertAngle(currentDeviceMotion.orientation.alpha),
                    y: convertAngle(currentDeviceMotion.orientation.beta - 90),
                    z: convertAngle(currentDeviceMotion.orientation.gamma)
                };
            }
        }
         else {
             if(!currentDeviceMotion.rotationRate.beta){
                 return;
             }

            let xRotation = convertAngle(-currentDeviceMotion.rotationRate.alpha);
            let yRotation = convertAngle(-currentDeviceMotion.rotationRate.beta);
            let zRotation = convertAngle(currentDeviceMotion.rotationRate.gamma);

            currentDeviceMotion.currentRotation = {
                x: xRotation + currentDeviceMotion.currentRotation.x,
                y: yRotation + currentDeviceMotion.currentRotation.y,
                z: zRotation + currentDeviceMotion.currentRotation.z
            };

            currentDeviceMotion.rotationRate.alpha = 0;
            currentDeviceMotion.rotationRate.beta = 0;
            currentDeviceMotion.rotationRate.gamma = 0;
        }
    }

    function calculateMoving() {
        currentDeviceMotion.acceleration = {
            x: 0,
            y: 0,
            z: 0
        };
    }

    function handleOrientation(event){
        currentDeviceMotion.orientation = {
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma
        };
    }

    function handleDeviceMotion(event) {
        currentDeviceMotion.rotationRate = {
            alpha: event.rotationRate.alpha * event.interval + currentDeviceMotion.rotationRate.alpha || 0,
            beta: event.rotationRate.beta * event.interval + currentDeviceMotion.rotationRate.beta || 0,
            gamma: event.rotationRate.gamma * event.interval + currentDeviceMotion.rotationRate.gamma || 0
        };

        let xAcc = (Math.abs(event.acceleration.x) > 0.01) ? 1000 * event.acceleration.x * Math.pow(event.interval, 2) / 2 : 0;
        let yAcc = (Math.abs(event.acceleration.y) > 0.01) ? 1000 * event.acceleration.y * Math.pow(event.interval, 2) / 2 : 0;
        let zAcc = (Math.abs(event.acceleration.z) > 0.01) ? 1000 * event.acceleration.z * Math.pow(event.interval, 2) / 2 : 0;

        currentDeviceMotion.acceleration = {
            x: xAcc + currentDeviceMotion.acceleration.x || 0,
            y: yAcc + currentDeviceMotion.acceleration.y || 0,
            z: zAcc + currentDeviceMotion.acceleration.z || 0
        };

        currentDeviceMotion.accelerationIncludingGravity = {
            alpha: event.accelerationIncludingGravity.alpha + currentDeviceMotion.accelerationIncludingGravity.alpha || 0,
            beta: event.accelerationIncludingGravity.beta + currentDeviceMotion.accelerationIncludingGravity.beta || 0,
            gamma: event.accelerationIncludingGravity.gamma + currentDeviceMotion.accelerationIncludingGravity.gamma || 0
        };

        currentDeviceMotion.interval += event.interval;
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

    function convertAngle(angle){
        return angle * Math.PI / 180;
    }

    function convertAngleOpposite(angle) {
        return 180 * angle / Math.PI;
    }

    function sendLog(log){
        const Http = new XMLHttpRequest();
        const url='https://192.168.1.70:8000/console?log=' + log;
        Http.open("GET", url);
        Http.send();
    }
}

