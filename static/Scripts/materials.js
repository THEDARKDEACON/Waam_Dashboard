function initMaterialsPage() {
    // Load from localStorage or use default
    let materials = JSON.parse(localStorage.getItem("materials")) || [
        { name: "AISI4043 0.9mm", current: 140, voltage: 20, wireFeed: 4, travelSpeed: 4 },
        { name: "AISI4043 1.2mm", current: 150, voltage: 25, wireFeed: 5, travelSpeed: 4 }
    ];

    const tableBody = document.getElementById("materials-body");
    const addBtn = document.getElementById("add-btn");

    // Helper to save to localStorage
    function saveMaterials() {
        localStorage.setItem("materials", JSON.stringify(materials));
    }

    // Render materials list
    function renderMaterials() {
        tableBody.innerHTML = "";

        materials.forEach((m, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><input type="text" value="${m.name}" data-index="${index}" data-field="name"></td>
                <td><input type="number" value="${m.current}" data-index="${index}" data-field="current"></td>
                <td><input type="number" value="${m.voltage}" data-index="${index}" data-field="voltage"></td>
                <td><input type="number" value="${m.wireFeed}" data-index="${index}" data-field="wireFeed"></td>
                <td><input type="number" value="${m.travelSpeed}" data-index="${index}" data-field="travelSpeed"></td>
                <td><button class="remove-btn" data-index="${index}">Remove</button></td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Initial render
    renderMaterials();

    // Add new material
    addBtn.onclick = () => {
        const name = document.getElementById("new-name").value.trim();
        const current = +document.getElementById("new-current").value;
        const voltage = +document.getElementById("new-voltage").value;
        const wireFeed = +document.getElementById("new-wire").value;
        const travelSpeed = +document.getElementById("new-travel").value;

        if (!name) return alert("Please enter a material name.");

        materials.push({ name, current, voltage, wireFeed, travelSpeed });
        saveMaterials();
        renderMaterials();

        // Clear inputs
        document.getElementById("new-name").value = "";
        document.getElementById("new-current").value = "";
        document.getElementById("new-voltage").value = "";
        document.getElementById("new-wire").value = "";
        document.getElementById("new-travel").value = "";
    };

    // Remove material
    tableBody.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-btn")) {
            const idx = +e.target.dataset.index;
            materials.splice(idx, 1);
            saveMaterials();
            renderMaterials();
        }
    });

    // Update material live when edited
    tableBody.addEventListener("input", (e) => {
        const field = e.target.dataset.field;
        const idx = +e.target.dataset.index;
        if (!field) return;
        materials[idx][field] = e.target.type === "number" ? +e.target.value : e.target.value;
        saveMaterials();
    });
}
