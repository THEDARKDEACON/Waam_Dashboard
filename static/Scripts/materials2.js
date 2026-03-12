
 console.log("Materials script loaded");
  // Simulated data source
  let materials = [
    { name: "AISI4043 0.9mm", current: 140, voltage: 20, wire: 4, travel: 4 },
    { name: "AISI4043 1.2mm", current: 150, voltage: 25, wire: 5, travel: 4 }
  ];

  const tableBody = document.getElementById("materials-body");
  const addBtn = document.getElementById("add-btn");

  function renderMaterials() {
    tableBody.innerHTML = "";
    materials.forEach((m, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="text" value="${m.name}" disabled></td>
        <td><input type="text" value="${m.current}" disabled></td>
        <td><input type="text" value="${m.voltage}" disabled></td>
        <td><input type="text" value="${m.wire}" disabled></td>
        <td><input type="text" value="${m.travel}" disabled></td>
        <td><button class="remove-btn" data-index="${index}">Remove</button></td>
      `;
      tableBody.appendChild(row);
    });

    // Attach remove handlers
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = e.target.dataset.index;
        materials.splice(index, 1);
        renderMaterials();
      });
    });
  }

  addBtn.addEventListener("click", () => {
    const name = document.getElementById("new-name").value.trim();
    const current = +document.getElementById("new-current").value;
    const voltage = +document.getElementById("new-voltage").value;
    const wire = +document.getElementById("new-wire").value;
    const travel = +document.getElementById("new-travel").value;

    if (!name || !current || !voltage || !wire || !travel) {
      alert("Please fill all fields.");
      return;
    }

    materials.push({ name, current, voltage, wire, travel });
    renderMaterials();

    // Clear inputs
    document.querySelectorAll(".add-row input").forEach(i => i.value = "");
  });

  renderMaterials();


const weldSelect = document.getElementById("weld-profile");
weldSelect.innerHTML = "";

if (typeof materials !== "undefined" && materials.length > 0) {
  const manualOption = document.createElement("option");
  manualOption.textContent = "Use Manual Settings";
  weldSelect.appendChild(manualOption);

  materials.forEach(mat => {
    const opt = document.createElement("option");
    opt.textContent = mat.name;
    weldSelect.appendChild(opt);
  });
} else {
  weldSelect.innerHTML = "<option>No materials found</option>";
}

// File upload functionality
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("fileInput");
const fileStatus = document.getElementById("file-status");

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    fileStatus.innerHTML = `
      File <span style="color: blue; text-decoration: underline;">${file.name}</span> uploaded successfully
    `;
  }
});

// // Buttons (placeholders for future actions)
// document.getElementById("visualize-btn").addEventListener("click", () => {
//   alert("Visualizing path...");
// });

// document.getElementById("simulate-btn").addEventListener("click", () => {
//   alert("Simulation started...");
// });
