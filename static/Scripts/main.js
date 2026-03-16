// listen for page loads
import { init } from './canvas.js';
import { socket } from './robot_socket.js';

document.addEventListener("DOMContentLoaded", () => {

    init(); // initialize the 3D canvas
    const robotStatusDot = document.getElementById('robot-status-dot');
    const robotStatusText = document.getElementById('robot-status-text');
    const adminButton = document.getElementById('admin-btn');
    const adminStateText = document.getElementById('admin-state');
    const adminModal = document.getElementById('admin-modal');
    const adminModalMessage = document.getElementById('admin-modal-message');
    const adminModalAccept = document.getElementById('admin-modal-accept');
    const adminModalDecline = document.getElementById('admin-modal-decline');
    let isAdmin = false;

    const formatSid = (sid) => sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : "Unknown";

    const updateRobotStatus = (online) => {
        if (!robotStatusDot || !robotStatusText) return;
        robotStatusDot.classList.toggle('online', online);
        robotStatusDot.classList.toggle('offline', !online);
        robotStatusText.textContent = online ? "Online" : "Offline";
    };

    const hideAdminModal = () => {
        adminModal?.classList.remove('visible');
    };

    adminButton?.addEventListener('click', () => {
        console.log(isAdmin ? "Releasing admin control" : "Requesting admin control");
        if (isAdmin) {
            socket.emit("release_admin");
        } else {
            socket.emit("request_admin");
        }
    });

    adminModalAccept?.addEventListener('click', () => {
        socket.emit('admin_relinquish_response', { accept: true });
        hideAdminModal();
    });

    adminModalDecline?.addEventListener('click', () => {
        socket.emit('admin_relinquish_response', { accept: false });
        hideAdminModal();
    });

    socket.on("robot_status", (data) => {
        updateRobotStatus(Boolean(data?.online));
    });

    socket.on("admin_update", (data) => {
        const currentSid = socket.id;
        isAdmin = data.admin_sid === currentSid;
        if (adminButton) {
            adminButton.textContent = isAdmin ? "Release Admin" : "Claim Admin";
        }
        if (adminStateText) {
            if (data.admin_sid) {
                adminStateText.textContent = isAdmin ? "You are controlling the robot." : `Controlled by ${formatSid(data.admin_sid)}`;
            } else {
                adminStateText.textContent = "No one is controlling the robot.";
            }
            if (data.pending_sid && !isAdmin) {
                adminStateText.textContent += ` | Request pending from ${formatSid(data.pending_sid)}`;
            }
        }
    });

    socket.on("admin_relinquish_request", (data) => {
        if (!adminModalMessage) return;
        adminModalMessage.textContent = `User ${formatSid(data?.requester_sid)} requests control.`;
        adminModal?.classList.add('visible');
    });

    socket.on("admin_request_denied", () => {
        if (adminStateText) {
            adminStateText.textContent = "Your admin request was denied.";
        }
    });

    socket.on("admin_granted", () => {
        if (adminStateText) {
            adminStateText.textContent = "You now control the robot.";
        }
    });


    const robot_parameters_btn = document.querySelector('button[data-page="robot"]');
    const task_editor_btn = document.querySelector('button[data-page="task_editor"]');
    const jog_btn = document.querySelector('button[data-page="jog"]');
 

     //// Main content sections ////
    const robot_page = document.querySelector(".robot-page");
    const task_editor = document.querySelector(".task_editor_container");
    const jog_page = document.querySelector(".jog-container");

    //// Robot Parameters Sub-tabs ////
    const robot_settings_btn = document.querySelector('button[data-section="robot_settings"]');
    const sensors_btn = document.querySelector('button[data-section="sensors"]');
    const materials_btn = document.querySelector('button[data-section="materials"]');

    const robot_sub_page = document.querySelector(".robot-settings");
    const sensors_page = document.querySelector(".sensors-container");
    const materials_page = document.querySelector(".materials-container");

    loadRobotSettings(); // default load robot parameters page
    loadRobotparameters(); // default load robot parameters page

    // once a button is clicked, remove active from all buttons and add to clicked button
    robot_parameters_btn.addEventListener("click", () => {
        robot_parameters_btn.classList.add("active");
        task_editor_btn.classList.remove("active");
        jog_btn.classList.remove("active");
        loadRobotparameters();
    });

    task_editor_btn.addEventListener("click", () => {
        task_editor_btn.classList.add("active");
        robot_parameters_btn.classList.remove("active");
        jog_btn.classList.remove("active");
        loadTaskEditor();
    });

    jog_btn.addEventListener("click", () => {
        jog_btn.classList.add("active");
        robot_parameters_btn.classList.remove("active");
        task_editor_btn.classList.remove("active");
        loadJogPage();
    });

    function loadRobotparameters(){
        // show robot parameters, hide others
        robot_page.style.display = "flex";
        task_editor.style.display = "none";
        jog_page.style.display = "none";

    }

    function loadTaskEditor(){
        // show task editor, hide others
        task_editor.style.display = "flex";
        robot_page.style.display = "none";
        jog_page.style.display = "none";
    }

    function loadJogPage(){
        // show jog page, hide others
        // for now, just hide others
        jog_page.style.display = "flex";
        robot_page.style.display = "none";
        task_editor.style.display = "none";
    }

    robot_settings_btn.addEventListener("click", () => {
        robot_settings_btn.classList.add("active");
        sensors_btn.classList.remove("active");
        materials_btn.classList.remove("active");
        loadRobotSettings();
    });

    sensors_btn.addEventListener("click", () => {
        sensors_btn.classList.add("active");
        robot_settings_btn.classList.remove("active");
        materials_btn.classList.remove("active");
        loadSensors();
    }); 

    materials_btn.addEventListener("click", () => {
        materials_btn.classList.add("active");
        robot_settings_btn.classList.remove("active");
        sensors_btn.classList.remove("active");
        loadMaterials();
    });

    function loadRobotSettings(){
        // show robot settings, hide others
        robot_sub_page.style.display = "flex";
        sensors_page.style.display = "none";
        materials_page.style.display = "none";
    }

    function loadSensors(){
        // show sensors page, hide others
        sensors_page.style.display = "flex";
        robot_sub_page.style.display = "none";
        materials_page.style.display = "none";
    }



    function loadMaterials(){
        // show materials page, hide others
        materials_page.style.display = "flex";
        robot_sub_page.style.display = "none";
        sensors_page.style.display = "none";
    }

    
    // Task editor canvas tabs
    const gcode_tab_btn = document.querySelector('button[data-page="G_code"]');
    const robot_tab_btn = document.querySelector('button[data-page="Robot_visual"]');
    const gcode_canvas = document.querySelector('.gcodeCanvas');
    const robot_canvas = document.querySelector('.robotCanvas');

    gcode_tab_btn.addEventListener("click", () => {
        gcode_tab_btn.classList.add("active");
        robot_tab_btn.classList.remove("active");
        gcode_canvas.style.display = "block";
        robot_canvas.style.display = "none";
    }

    );
    robot_tab_btn.addEventListener("click", () => {
        robot_tab_btn.classList.add("active");
        gcode_tab_btn.classList.remove("active");
        robot_canvas.style.display = "block";
        gcode_canvas.style.display = "none";
    });
    

    const setup_tab_btn = document.querySelector('button[data-page="Setup"]');
    const code_tab_btn = document.querySelector('button[data-page="code"]');
    const monitor_tab_btn = document.querySelector('button[data-page="monitoring"]');

    const setup = document.querySelector('.setup');
    const code = document.querySelector('.code');
    const monitor = document.querySelector('.monitor');

    setup_tab_btn.addEventListener("click", () =>{
        setup_tab_btn.classList.add("active");
        code_tab_btn.classList.remove("active")
        monitor_tab_btn.classList.remove("active");

        setup.style.display = "grid";
        code.style.display = "none";
        monitor.style.display = "none";

    })

    code_tab_btn.addEventListener("click", () =>{
        setup_tab_btn.classList.remove("active");
        code_tab_btn.classList.add("active")
        monitor_tab_btn.classList.remove("active");

        setup.style.display = "none";
        code.style.display = "grid";
        monitor.style.display = "none";

    })
    
    monitor_tab_btn.addEventListener("click", () =>{
        setup_tab_btn.classList.remove("active");
        code_tab_btn.classList.remove("active")
        monitor_tab_btn.classList.add("active");

        setup.style.display = "none";
        code.style.display = "none";
        monitor.style.display = "grid";

    })

    //////////////////////////////////////////////////////////
    ////////////////////////JOG PAGE /////////////////////////
    //////////////////////////////////////////////////////////
    // get value from range
    const rangeInput = document.querySelector("#speed");
    const valueDisplay = document.querySelector("#speed-value");
    rangeInput.addEventListener("change", ()=>{
        var value = rangeInput.value
        valueDisplay.innerHTML = value + "%";

    })

    const minusButton= document.querySelector(".minus")
    minusButton.addEventListener("mousedown", ()=>{
        minusButton.style.backgroundColor = "#c03e2f";
        

        // more stuff
    });

    minusButton.addEventListener("mouseup", ()=>{
        minusButton.style.backgroundColor = "#e74c3c";
    });


    const plusButton= document.querySelector(".plus")
    plusButton.addEventListener("mousedown", ()=>{
        plusButton.style.backgroundColor = "#1e884b";
        

        // more stuff
    })
    plusButton.addEventListener("mouseup", ()=>{
        plusButton.style.backgroundColor = "#2ecc71";
    })

})
