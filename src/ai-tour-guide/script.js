const BASE_URL = 'http://127.0.0.1:8000/api/v1/monuments'; 

const urlParams = new URLSearchParams(window.location.search);
const monumentId = urlParams.get('id');

const displayId = document.getElementById('displayId');
const monumentTitle = document.getElementById('monumentTitle');
const generateStoryBtn = document.getElementById('generateStoryBtn');
const generateAudioBtn = document.getElementById('generateAudioBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const storyContainer = document.getElementById('storyContainer');
const storyContent = document.getElementById('storyContent');
const sourcesList = document.getElementById('sourcesList');
const researchStatus = document.getElementById('researchStatus');
const emptyState = document.getElementById('emptyState');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const authPromptBtn = document.getElementById('authPromptBtn');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const nativeAudioPlayer = document.getElementById('nativeAudioPlayer');
const downloadAudioBtn = document.getElementById('downloadAudioBtn');

if (monumentId) {
    displayId.textContent = `ID: ${monumentId}`;
    monumentTitle.textContent = `Track #${monumentId}`;
}

function getAuthHeaders() {
    const token = localStorage.getItem('virasat_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function requireAuth() {
    authPromptBtn.classList.remove('hidden');
    window.location.href = '../landing-page/index.html?auth_error=invalid';
}

function setLoader(active, text = 'Processing...') {
    if (active) {
        loadingText.textContent = text;
        loadingOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    } else {
        loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => loadingOverlay.classList.add('hidden'), 300);
    }
}

async function fetchStory(id) {
    try {
        setLoader(true, 'Synthesizing historical records...');
        
        const response = await fetch(`${BASE_URL}/${id}/story`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            credentials: 'init' 
        });

        if (response.status === 401) return requireAuth();
        if (!response.ok) throw new Error('Story generation failed');

        const data = await response.json();
        renderStory(data);
    } catch (error) {
        alert("Unable to generate script at this moment. Please check backend connection.");
    } finally {
        setLoader(false);
    }
}

async function fetchAudio(id, autoRetry = false) {
    try {
        setLoader(true, 'Rendering spatial MP3 via Fish Audio...');

        const response = await fetch(`${BASE_URL}/${id}/audio`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'init'
        });

        if (response.status === 401) return requireAuth();
        
        if (response.status === 404 && !autoRetry) {
            setLoader(true, 'Script missing. Generating story first...');
            await fetchStory(id);
            return fetchAudio(id, true);
        }

        if (!response.ok) throw new Error('Audio generation failed');

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        renderAudioPlayer(audioUrl);
    } catch (error) {
        alert("Failed to render MP3. Check backend connectivity.");
    } finally {
        setLoader(false);
    }
}

function renderStory(data) {
    emptyState.classList.add('hidden');
    storyContainer.classList.remove('hidden');
    
    setTimeout(() => {
        storyContainer.classList.remove('opacity-0');
    }, 50);

    statusDot.classList.replace('bg-terra', 'bg-emerald-500');
    statusText.textContent = 'Script Generated';
    
    storyContent.innerHTML = data.story.split('\n').map(p => `<p class="mb-4">${p}</p>`).join('');
    researchStatus.textContent = data.research_status || 'Verified';
    
    sourcesList.innerHTML = '';
    if (data.sources && Array.isArray(data.sources)) {
        data.sources.forEach(source => {
            const li = document.createElement('li');
            li.textContent = source;
            sourcesList.appendChild(li);
        });
    }
}

function renderAudioPlayer(blobUrl) {
    emptyState.classList.add('hidden');
    audioPlayerContainer.classList.remove('hidden');
    
    setTimeout(() => {
        audioPlayerContainer.classList.remove('opacity-0', 'translate-y-4');
    }, 50);

    statusDot.classList.replace('bg-terra', 'bg-emerald-500');
    statusText.textContent = 'Audio Ready';

    nativeAudioPlayer.src = blobUrl;
    downloadAudioBtn.href = blobUrl;
    
    nativeAudioPlayer.play().catch(e => console.log('Autoplay prevented by browser'));
}

generateStoryBtn.addEventListener('click', () => {
    if (!monumentId) return alert('No monument selected.');
    fetchStory(monumentId);
});

generateAudioBtn.addEventListener('click', () => {
    if (!monumentId) return alert('No monument selected.');
    fetchAudio(monumentId);
});

authPromptBtn.addEventListener('click', requireAuth);
