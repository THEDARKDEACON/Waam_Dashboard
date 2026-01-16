

// var angles = [0, Math.PI/2, -Math.PI/2, 0, 0, 0];

// function setJointAngles(a) {
//     if (!joints.j1) return; // wait for model
//     joints.j1.rotation.y = -a[0];
//     joints.j2.rotation.z = -a[1];
//     joints.j3.rotation.z = -a[2];
//     joints.j4.rotation.x = -a[3];
//     joints.j5.rotation.z = -a[4];
//     joints.j6.rotation.x = -a[5];
// }

// // Load the KUKA KR6 model
// const loader = new GLTFLoader();
// let joints = {};

// function loadRobotModel(scene) {


//   loader.load("./static/gltf/kuka.glb", (gltf) => {
//     const robot = gltf.scene;
//     scene.add(robot);

//     // Example: find joints by name
//     joints = {
//         j1: robot.getObjectByName('link_1'),
//         j2: robot.getObjectByName('link_2'),
//         j3: robot.getObjectByName('link_3'),
//         j4: robot.getObjectByName('link_4'),
//         j5: robot.getObjectByName('link_5'),
//         j6: robot.getObjectByName('link_6'),
//         };
//     });
// }


// export { setJointAngles, loadRobotModel , angles };