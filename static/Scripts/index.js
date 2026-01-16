document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".tab");
    const content = document.getElementById("content");


    // Load default page
    loadPage("robot");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            loadPage(btn.dataset.page);
        });
    });

    function loadPage(page) {
    fetch(`pages/${page}.html`)
        .then(res => res.text())
        .then(html => {
            content.innerHTML = html;
            if (page === "robot") loadRobotDefault(); // ✅ auto-load first section
        })
        .catch(err => console.error("Error loading page:", err));
    }
});

// Handles sub-tabs inside the Robot Parameters page
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("nav-btn")) {
        const buttons = e.target.closest(".robot-nav").querySelectorAll(".nav-btn");
        buttons.forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");

        const section = e.target.dataset.section;
        const container = document.getElementById("robot-content");

        if (section == "materials") {
            // check if materials.js is already loaded
            const existingScript = document.querySelector('script[src="./Scripts/materials.js"]');
            if (existingScript) {
                
                // If already loaded, just load the subpage
                fetch("pages/materials.html")
                    .then(res => res.text())
                    .then(html => {
                        container.innerHTML = html;
                        initMaterialsPage();
                    })
                    .catch(err => console.error("Error loading subpage:", err));
                    
            }else{
        
                // Load the subpage
                fetch("pages/materials.html")
                    .then(res => res.text())
                    .then(html => {
                        container.innerHTML = html;
                        const script = document.createElement("script");
                        script.src = "./Scripts/materials.js";
                        script.onload = () => initMaterialsPage();
                        document.body.appendChild(script);
                    })
                    .catch(err => console.error("Error loading subpage:", err));
            }
        }else{
           // Load the subpage
            fetch(`pages/${section}.html`)
                .then(res => res.text())
                .then(html => {
                    container.innerHTML = html;
                })
                .catch(err => console.error("Error loading subpage:", err)); 
        }

    }
});

// Load default section when Robot page opens
function loadRobotDefault() {
    const container = document.getElementById("robot-content");
    fetch("pages/robot_settings.html")
        .then(res => res.text())
        .then(html => container.innerHTML = html)
        .catch(err => console.error("Error loading default robot section:", err));
}
