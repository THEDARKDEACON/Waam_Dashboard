import * as THREE from '../three/build/three.module.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';

function init(){// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

var points = [];

const canvas = document.querySelector('.gcodeCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
camera.position.set(0.4, 0.4, 0.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

const grid = new THREE.GridHelper(2, 20, 0x777777, 0x444444);
// grid.rotation.x = Math.PI / 2; // rotate 90° around X to lie on XY plane
scene.add(grid);

const axesHelper = new THREE.AxesHelper(0.05);
scene.add(axesHelper);

const light = new THREE.AmbientLight(0xffffff,1);
scene.add(light);


document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    points = []; // reset points
    // renderer.scene = scene; // reset scene
    scene.remove(...scene.children.filter(child => child.type === 'LineSegments')); // remove previous G-code lines
    drawGCode(text);
});

function drawGCode(gcode) {
    const lines = gcode.split('\n');
    let lastPos = new THREE.Vector3(0, 0, 0);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    lines.forEach(line => {
    line = line.trim();
    if (!line.startsWith('G')) return;

    const matchX = line.match(/X(-?\d+(\.\d+)?)/);
    const matchY = line.match(/Y(-?\d+(\.\d+)?)/);
    const matchZ = line.match(/Z(-?\d+(\.\d+)?)/);

    const newPos = lastPos.clone();

    if (matchX) newPos.x = parseFloat(matchX[1])/1000;
    if (matchY) newPos.y = parseFloat(matchY[1])/1000;
    if (matchZ) newPos.z = parseFloat(matchZ[1])/1000;

    if (line.startsWith('G0') || line.startsWith('G1')) {
        points.push(lastPos.clone(), newPos.clone());
    }

    lastPos = newPos;
    });
//   console.log(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const path = new THREE.LineSegments(geometry, material);
    path.rotation.x = -Math.PI / 2;
    scene.add(path);
}

function resizeRendererToCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function animate() {
    resizeRendererToCanvas();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

}

export { init };