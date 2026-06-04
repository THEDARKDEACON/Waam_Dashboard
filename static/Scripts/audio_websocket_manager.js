const audiowsUrl = "ws://192.168.0.103:8765";
const audio_socket = new WebSocket(audiowsUrl);

const MAX_RECONNECT_DELAY = 10000;
let audioReconnectTimer = null;
let audioReconnectDelay = 1000;


function initAudioWS() {

    audio_socket.onopen = () => {
        console.log('Audio WebSocket connected');
    };

    audio_socket.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            // console.log(event.data);

            const plotEvent = new CustomEvent('ws-plot-data', {
                detail: {
                    audio: payload.audio,
                    kurtosis: payload.kurtosis
                }
            });
            window.dispatchEvent(plotEvent);

            const logEvent = new CustomEvent('ws-log-data', {
                detail: {
                    db: payload.db,
                    kurtosis: payload.kurtosis
                }
            });
            window.dispatchEvent(logEvent);

        } catch (error) {
            console.error('Failed to process Audio WebSocket payload:', error);
        }
    };

    audio_socket.onerror = (error) => {
        console.error('Audio WebSocket Error:', error);
    };

    audio_socket.onclose = () => {
        console.warn('Audio WebSocket connection closed.');
        scheduleReconnect();
    };

}

function scheduleReconnect() {
    if (audioReconnectTimer) return;

    audioReconnectTimer = setTimeout(() => {
        audioReconnectTimer = null;
        audioReconnectDelay = Math.min(audioReconnectDelay * 2, MAX_RECONNECT_DELAY);
        initAudioWS();
    }, audioReconnectDelay);
}

initAudioWS();