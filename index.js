let output = document.querySelector('.output');

function handleOrientation(event) {
    let absolute = event.absolute;
    let alpha    = event.alpha;
    let beta     = event.beta;
    let gamma    = event.gamma;

    output.innerHTML  = "absolute : " + absolute + "\n";
    output.innerHTML += "alpha: " + alpha + "\n";
    output.innerHTML += "beta: " + beta + "\n";
    output.innerHTML += "gamma: " + gamma + "\n";
}

window.addEventListener('deviceorientation', handleOrientation);
