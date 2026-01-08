import * as THREE from "three";
import { OrbitControls } from "three/examples/controls/OrbitControls.js";

/* ================= 基础場景核心 ================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(8, 8, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
// 配置輸出色彩空間與色調映射，讓 PBR glTF 模型（如豹子）顏色更接近原站預覽
if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
if (THREE.ACESFilmicToneMapping !== undefined) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
}
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const clock = new THREE.Clock();

/* ================= 灯光 ================= */

scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(10, 15, 8);
dirLight.castShadow = true;
scene.add(dirLight);

/* ================= 地面與網格 ================= */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(50, 50, 0x444444, 0x444444);
grid.position.y = 0.001;
scene.add(grid);

/* ================= 射線工具 ================= */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const snap = v => Math.floor(v);

function onWindowResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", onWindowResize);

export {
  THREE,
  scene,
  camera,
  renderer,
  controls,
  clock,
  ground,
  grid,
  raycaster,
  mouse,
  snap
};
