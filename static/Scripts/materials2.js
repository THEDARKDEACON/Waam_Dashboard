console.log("Materials script loaded");

let materials = [];

const tableBody = document.getElementById("materials-body");
const addBtn = document.getElementById("add-btn");
const weldSelect = document.getElementById("weld-profile");

const newInputs = {
  name: document.getElementById("new-name"),
  current: document.getElementById("new-current"),
  voltage: document.getElementById("new-voltage"),
  wire: document.getElementById("new-wire"),
  travel: document.getElementById("new-travel")
};

function renderMaterials() {
  tableBody.innerHTML = "";
  if (!materials.length) {
    tableBody.innerHTML = "<tr><td colspan='6'>No materials configured.</td></tr>";
    return;
  }

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

  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", async (event) => {
      const index = Number(event.target.dataset.index);
      if (Number.isFinite(index) && materials[index]) {
        materials.splice(index, 1);
        renderMaterials();
        await persistMaterials();
        populateWeldSelect();
      }
    });
  });
}

function populateWeldSelect() {
  if (!weldSelect) return;
  weldSelect.innerHTML = "";
  const manualOption = document.createElement("option");
  manualOption.textContent = "Use Manual Settings";
  weldSelect.appendChild(manualOption);

  if (!materials.length) {
    const empty = document.createElement("option");
    empty.textContent = "No materials found";
    empty.disabled = true;
    weldSelect.appendChild(empty);
    return;
  }

  materials.forEach(mat => {
    const option = document.createElement("option");
    option.textContent = mat.name;
    weldSelect.appendChild(option);
  });
}

async function fetchMaterials() {
  try {
    const resp = await fetch("/api/materials");
    if (!resp.ok) throw new Error("Failed to load materials");
    materials = await resp.json();
  } catch (err) {
    console.error("Error loading materials", err);
    materials = [];
  } finally {
    renderMaterials();
    populateWeldSelect();
  }
}

async function persistMaterials() {
  try {
    await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials })
    });
  } catch (err) {
    console.error("Failed to save materials", err);
  }
}

addBtn.addEventListener("click", async () => {
  const payload = {
    name: newInputs.name.value.trim(),
    current: Number(newInputs.current.value),
    voltage: Number(newInputs.voltage.value),
    wire: Number(newInputs.wire.value),
    travel: Number(newInputs.travel.value)
  };

  if (!payload.name || !payload.current || !payload.voltage || !payload.wire || !payload.travel) {
    alert("Please fill all fields.");
    return;
  }

  materials.push(payload);
  renderMaterials();
  await persistMaterials();
  populateWeldSelect();

  Object.values(newInputs).forEach(input => {
    input.value = "";
  });
});

fetchMaterials();

// File upload feedback (unused backend)
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("fileInput");
const fileStatus = document.getElementById("file-status");

uploadBtn?.addEventListener("click", () => fileInput?.click());

fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file && fileStatus) {
    fileStatus.innerHTML = `
      File <span style="color: blue; text-decoration: underline;">${file.name}</span> uploaded successfully
    `;
  }
});
