import * as THREE from '../three/build/three.module.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import {angles } from "./robot_socket.js"

// import { setJointAngles, angles, loadRobotModel } from './kuka_comm.js';

const scene = new THREE.Scene();
scene.rotateY(-Math.PI/2)
scene.background = new THREE.Color(0x111111);

var points = [];

const canvas = document.querySelector('#robotCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
camera.position.set(1.5, 1.5, 1.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

const grid = new THREE.GridHelper(5, 20, 0x777777, 0x444444);
// grid.rotation.x = Math.PI / 2; // rotate 90° around X to lie on XY plane
scene.add(grid);

const axesHelper = new THREE.AxesHelper(0.5);
scene.add(axesHelper);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 4, -2);
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));


// Load the KUKA KR6 model
const loader = new GLTFLoader();
let joints = {};

loader.load("./static/gltf/kuka.glb", (gltf) => {
    const robot = gltf.scene;
    scene.add(robot);

    // Example: find joints by name
    joints = {
        j1: robot.getObjectByName('link_1'),
        j2: robot.getObjectByName('link_2'),
        j3: robot.getObjectByName('link_3'),
        j4: robot.getObjectByName('link_4'),
        j5: robot.getObjectByName('link_5'),
        j6: robot.getObjectByName('link_6'),
        };
    });

// Example angles (radians)
function setJointAngles(a) {
    if (!joints.j1) return; // wait for model
    joints.j1.rotation.y = -a[0];
    joints.j2.rotation.z = -a[1];
    joints.j3.rotation.z = -a[2];
    joints.j4.rotation.x = -a[3];
    joints.j5.rotation.z = -a[4];
    joints.j6.rotation.x = -a[5];
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
    setJointAngles(angles);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

