import * as THREE from '../three/build/three.module.js';
import { OrbitControls } from '../three/examples/jsm/controls/OrbitControls.js';
import { socket } from './robot_socket.js';

function init(){// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

var points = [];
const pathObjects = [];
const pathGroup = new THREE.Group();
pathGroup.rotation.x = -Math.PI / 2;
scene.add(pathGroup);

const animationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.002, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
);
animationMarker.visible = false;
let animationPath = [];
let animationIndex = 0;
let animationFrameCounter = 0;
const FRAMES_PER_STEP = 4;

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
pathGroup.add(animationMarker);

const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('upload-btn');
const fileStatus = document.getElementById('file-status');
const generateButton = document.getElementById('visualize-btn');
const loader = document.getElementById('krl-loader');
let selectedGcodeFile = null;

uploadButton?.addEventListener('click', () => fileInput?.click());

fileInput?.addEventListener('change', async (e) => {
    const target = e.target;
    const file = target.files?.[0];
    if (!file) {
        fileStatus.textContent = "No file selected";
        return;
    }

    selectedGcodeFile = file;
    fileStatus.textContent = `Loaded ${file.name}`;
    try {
        const text = await file.text();
        points = [];
        scene.remove(...scene.children.filter(child => child.type === 'LineSegments'));
        drawGCode(text);
    } catch (err) {
        console.error("Failed to read file", err);
        fileStatus.textContent = `Failed to load file: ${err?.message || err}`;
    } finally {
        target.value = "";
    }
});

const run_program_button = document.getElementById("run_program_local")
run_program_button.addEventListener("click", ()=>{
    socket.emit("run_program_local")
})

generateButton?.addEventListener('click', async () => {
    if (!selectedGcodeFile) {
        fileStatus.textContent = "Select a G-code file before generating KRL.";
        return;
    }
    toggleLoader(true);
    generateButton.disabled = true;
    fileStatus.textContent = `Generating KRL from ${selectedGcodeFile.name}...`;
    try {
        const downloadName = await uploadGcodeAndDownload(selectedGcodeFile);
        fileStatus.textContent = `Downloaded ${downloadName}`;
        run_program_button.style.display = "block"
    } catch (err) {
        console.error("KRL generation failed", err);
        fileStatus.textContent = `Generation failed: ${err?.message || err}`;
    } finally {
        toggleLoader(false);
        generateButton.disabled = false;
    }
});

function toggleLoader(show) {
    loader?.classList.toggle("active", show);
}

async function uploadGcodeAndDownload(file) {
    const form = new FormData();
    form.append("file", file);

    const resp = await fetch("/api/gcode", {
        method: "POST",
        body: form
    });

    if (!resp.ok) {
        const message = await resp.text();
        throw new Error(message || "Failed to process G-code");
    }

    const blob = await resp.blob();
    const disposition = resp.headers.get("Content-Disposition") || "";
    const dispositionMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    let downloadName = `${file.name.replace(/\.[^.]+$/, "") || "program"}_krl.zip`;
    if (dispositionMatch) {
        downloadName = dispositionMatch[1].replace(/['"]/g, "");
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);

    const segments = await requestToolpathSegments();
    drawToolpathSegments(segments);

    return downloadName;
}

async function requestToolpathSegments() {
    const resp = await fetch("/api/toolpath");
    if (!resp.ok) {
        const message = await resp.text();
        throw new Error(message || "Failed to fetch toolpath");
    }
    return resp.json();
}

function clearCanvasPaths() {
    pathObjects.forEach(obj => pathGroup.remove(obj));
    pathObjects.length = 0;
}

function drawGCode(gcode) {
    const lines = gcode.split('\n');
    let lastPos = new THREE.Vector3(0, 0, 0);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    points = [];
    clearCanvasPaths();

    lines.forEach(line => {
        line = line.trim();
        if (!line.startsWith('G')) return;

        const matchX = line.match(/X(-?\d+(\.\d+)?)/);
        const matchY = line.match(/Y(-?\d+(\.\d+)?)/);
        const matchZ = line.match(/Z(-?\d+(\.\d+)?)/);

        const newPos = lastPos.clone();

        if (matchX) newPos.x = parseFloat(matchX[1]) / 1000;
        if (matchY) newPos.y = parseFloat(matchY[1]) / 1000;
        if (matchZ) newPos.z = parseFloat(matchZ[1]) / 1000;

        if (line.startsWith('G0') || line.startsWith('G1')) {
            points.push(lastPos.clone(), newPos.clone());
        }

        lastPos = newPos;
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const path = new THREE.LineSegments(geometry, material);
    pathGroup.add(path);
    pathObjects.push(path);
}

function createVectorFromPoint(point) {
    return new THREE.Vector3(point[0] / 1000, point[1] / 1000, point[2] / 1000);
}

function drawToolpathSegments(segments) {
    clearCanvasPaths();
    segments?.forEach(segment => {
        if (!segment?.points || segment.points.length < 2) return;
        const points3d = segment.points.map(p => createVectorFromPoint(p));
        const geometry = new THREE.BufferGeometry().setFromPoints(points3d);
        const color = segment.torch_state === "TRUE" ? 0xff0000 : 0x0000ff;
        const material = new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(geometry, material);
        pathGroup.add(line);
        pathObjects.push(line);
    });
    setupToolpathAnimation(segments);
}

function setupToolpathAnimation(segments) {
    animationPath.length = 0;
    if (!segments?.length) {
        animationMarker.visible = false;
        return;
    }

    segments.forEach(segment => {
        segment?.points?.forEach(pt => {
            animationPath.push({
                position: createVectorFromPoint(pt),
                torch: segment.torch_state
            });
        });
    });

    if (animationPath.length) {
        animationIndex = 0;
        animationMarker.position.copy(animationPath[0].position);
        animationMarker.material.color.set(animationPath[0].torch === "TRUE" ? 0x00ff00 : 0x0000ff);
        animationMarker.visible = true;
    } else {
        animationMarker.visible = false;
    }
}

function updateToolpathAnimation() {
    if (!animationPath.length) {
        animationMarker.visible = false;
        return;
    }

    animationFrameCounter = (animationFrameCounter + 1) % FRAMES_PER_STEP;
    if (animationFrameCounter !== 0) {
        return;
    }

    animationIndex = (animationIndex + 1) % animationPath.length;
    const next = animationPath[animationIndex];
    animationMarker.position.copy(next.position);
    animationMarker.material.color.set(next.torch === "TRUE" ? 0x00ff00 : 0x0000ff);
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
    updateToolpathAnimation();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

}

export { init };
