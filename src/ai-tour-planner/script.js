const API_ENDPOINT = '/api/monuments';

const fallbackMonuments = [
    {
        id: "MON-101",
        name: "Taj Mahal Mausoleum",
        city: "Agra",
        location_tag: "Mughal Architecture",
        image_url: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=900&q=80",
        coordinates: "27.1751° N, 78.0421° E",
        reference_text: "Commissioned in 1632 by Emperor Shah Jahan, engineered with Makrana white marble and symmetrical charbagh acoustics along the Yamuna."
    },
    {
        id: "MON-104",
        name: "Dashashwamedh & Old Ghats",
        city: "Varanasi",
        location_tag: "Sacred Shrine",
        image_url: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=900&q=80",
        coordinates: "25.3069° N, 83.0103° E",
        reference_text: "One of the oldest continuously inhabited riverfronts in the world, anchoring centuries of Vedic chants, sandstone shrines, and evening Agni rituals."
    },
    {
        id: "MON-109",
        name: "Basilica of Bom Jesus",
        city: "Old Goa",
        location_tag: "Coastal Basilica",
        image_url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80",
        coordinates: "15.5009° N, 73.9116° E",
        reference_text: "Consecrated in 1605, this unplastered laterite Baroque basilica preserves gilded Corinthian altars and maritime Portuguese stone carvings."
    },
    {
        id: "MON-112",
        name: "Shree Jagannath Mandir",
        city: "Puri",
        location_tag: "Sacred Shrine",
        image_url: "https://images.unsplash.com/photo-1627894483216-2138af692e32?auto=format&fit=crop&w=900&q=80",
        coordinates: "19.8049° N, 85.8179° E",
        reference_text: "Towering 214 feet in Kalinga architectural style, crowned by the Nila Chakra wheel where the temple flag mysteriously billows opposite the wind."
    },
    {
        id: "MON-118",
        name: "Vijaya Vittala Stone Chariot",
        city: "Hampi",
        location_tag: "Ancient Ruins",
        image_url: "https://images.unsplash.com/photo-1600100397608-f010f423b971?auto=format&fit=crop&w=900&q=80",
        coordinates: "15.3426° N, 76.4754° E",
        reference_text: "16th-century Vijayanagara granite complex famed for its monolithic Garuda shrine and 56 musical Saregama pillars that resonate like bells."
    },
    {
        id: "MON-124",
        name: "Lachung Gompa & Valley",
        city: "North Sikkim",
        location_tag: "Himalayan Monastery",
        image_url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80",
        coordinates: "27.6891° N, 88.7429° E",
        reference_text: "Perched at 9,600 feet above the confluence of the Lachung and Lachen rivers, built in 1880 as a high-altitude Nyingma Buddhist sanctuary."
    }
];

let monumentsData = [];
let activeTag = 'all';
let selectedRoute = [];

const monumentGrid = document.getElementById('monumentGrid');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const tagButtons = document.querySelectorAll('.tag-pill');
const totalCounter = document.getElementById('totalCounter');
const emptyState = document.getElementById('emptyState');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const routeTray = document.getElementById('routeTray');
const routeCountBadge = document.getElementById('routeCountBadge');
const routeNamesPreview = document.getElementById('routeNamesPreview');

async function loadMonuments() {
    try {
        const res = await fetch(API_ENDPOINT);
        if (!res.ok) throw new Error('Using local archive');
        const data = await res.json();
        monumentsData = Array.isArray(data) ? data : (data.monuments || fallbackMonuments);
    } catch (err) {
        monumentsData = fallbackMonuments;
    }

    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    if (urlQuery) {
        searchInput.value = urlQuery;
        clearSearchBtn.classList.remove('hidden');
        clearSearchBtn.classList.add('flex');
    }

    applyFilters();
}

function renderCards(list) {
    monumentGrid.innerHTML = '';
    totalCounter.textContent = `${String(list.length).padStart(2, '0')} Archives`;

    if (list.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    list.forEach(item => {
        const isSelected = selectedRoute.some(r => String(r.id) === String(item.id));
        const card = document.createElement('article');
        card.className = 'monument-card bg-shell rounded-[32px] p-3.5 border border-white/70 flex flex-col justify-between';

        card.innerHTML = `
            <div>
                <div class="relative h-56 rounded-[24px] overflow-hidden mb-4 bg-oat">
                    <img src="${item.image_url}" alt="${item.name}" class="card-photo w-full h-full object-cover transition duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"></div>

                    <div class="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span class="bg-shell/95 backdrop-blur-md text-ink text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                            ${item.location_tag}
                        </span>
                        <span class="bg-black/50 backdrop-blur-md text-white/90 font-mono text-[10px] px-2.5 py-1 rounded-full tracking-wider">
                            #${item.id}
                        </span>
                    </div>

                    <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                        <div class="flex items-center gap-1.5 text-white">
                            <span class="w-2 h-2 rounded-full bg-terra"></span>
                            <span class="text-xs font-bold tracking-wide">${item.city}</span>
                        </div>
                        <button data-coords="${item.coordinates}" class="copy-coord-btn bg-black/55 hover:bg-black/80 backdrop-blur-md text-oat font-mono text-[10px] px-2.5 py-1 rounded-full transition" title="Copy GPS coordinates">
                            ${item.coordinates}
                        </button>
                    </div>
                </div>

                <div class="px-2">
                    <h2 class="text-xl font-bold text-ink leading-snug mb-2.5">${item.name}</h2>

                    <div class="bg-oat/65 rounded-2xl p-3 border-l-2 border-terra mb-4">
                        <p class="text-[10px] font-mono uppercase tracking-wider text-sub mb-1">Archival Reference</p>
                        <p class="text-xs text-ink/85 leading-relaxed line-clamp-3">${item.reference_text}</p>
                    </div>
                </div>
            </div>

            <div class="px-2 pt-3 perforated-divider flex items-center justify-between gap-2">
                <a href="../ai-tour-guide/index.html?id=${encodeURIComponent(item.id)}" class="text-xs font-bold text-ink hover:text-terra transition flex items-center gap-1.5 py-2">
                    <svg class="w-4 h-4 text-terra" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Listen Audio</span>
                </a>

                <button data-id="${item.id}" class="route-toggle-btn ${isSelected ? 'bg-terra text-white' : 'bg-ink text-shell'} text-xs font-semibold px-4 py-2 rounded-full transition">
                    ${isSelected ? '✓ In Trail' : '+ Add to Trail'}
                </button>
            </div>
        `;

        monumentGrid.appendChild(card);
    });

    bindCardActions();
}

function bindCardActions() {
    document.querySelectorAll('.route-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-id');
            const found = monumentsData.find(m => String(m.id) === String(targetId));
            if (!found) return;

            const existsIndex = selectedRoute.findIndex(r => String(r.id) === String(targetId));
            if (existsIndex > -1) {
                selectedRoute.splice(existsIndex, 1);
            } else {
                selectedRoute.push(found);
            }

            updateRouteTray();
            applyFilters();
        });
    });

    document.querySelectorAll('.copy-coord-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const coords = btn.getAttribute('data-coords');
            navigator.clipboard.writeText(coords);
            const original = btn.textContent;
            btn.textContent = 'Copied GPS';
            setTimeout(() => {
                btn.textContent = original;
            }, 1200);
        });
    });
}

function updateRouteTray() {
    if (selectedRoute.length > 0) {
        routeTray.classList.remove('translate-y-28', 'opacity-0', 'pointer-events-none');
        routeCountBadge.textContent = selectedRoute.length;
        routeNamesPreview.textContent = selectedRoute.map(m => m.name).join(' • ');
        localStorage.setItem('virasat_trail', JSON.stringify(selectedRoute));
    } else {
        routeTray.classList.add('translate-y-28', 'opacity-0', 'pointer-events-none');
        localStorage.removeItem('virasat_trail');
    }
}

function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = monumentsData.filter(item => {
        const matchesTag = activeTag === 'all' || item.location_tag.toLowerCase() === activeTag.toLowerCase();
        const matchesQuery = !query ||
            item.name.toLowerCase().includes(query) ||
            item.city.toLowerCase().includes(query) ||
            item.location_tag.toLowerCase().includes(query) ||
            item.coordinates.toLowerCase().includes(query) ||
            item.reference_text.toLowerCase().includes(query) ||
            String(item.id).toLowerCase().includes(query);

        return matchesTag && matchesQuery;
    });

    renderCards(filtered);
}

searchInput.addEventListener('input', () => {
    if (searchInput.value.trim().length > 0) {
        clearSearchBtn.classList.remove('hidden');
        clearSearchBtn.classList.add('flex');
    } else {
        clearSearchBtn.classList.add('hidden');
        clearSearchBtn.classList.remove('flex');
    }
    applyFilters();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    clearSearchBtn.classList.remove('flex');
    applyFilters();
});

tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tagButtons.forEach(b => {
            b.classList.remove('bg-ink', 'text-shell');
            b.classList.add('bg-oat', 'text-ink');
        });
        btn.classList.remove('bg-oat', 'text-ink');
        btn.classList.add('bg-ink', 'text-shell');
        activeTag = btn.getAttribute('data-tag');
        applyFilters();
    });
});

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeTag = 'all';
        clearSearchBtn.classList.add('hidden');
        tagButtons.forEach(b => {
            b.classList.remove('bg-ink', 'text-shell');
            b.classList.add('bg-oat', 'text-ink');
        });
        tagButtons[0].classList.remove('bg-oat', 'text-ink');
        tagButtons[0].classList.add('bg-ink', 'text-shell');
        applyFilters();
    });
}

loadMonuments();
