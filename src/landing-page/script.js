const spots = {
    heritage: {
        title: "Dawn at the Taj Mahal",
        badge: "Agra • Royal Wonder",
        weather: "28°C",
        listeners: "14,200+ travelers listened",
        time: "06:00 AM - 09:30 AM",
        crowd: "Low crowd hours",
        duration: "01h 45m",
        distance: "3.2 km",
        image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=900&q=80"
    },
    mountains: {
        title: "Lachung & Yumthang Valley",
        badge: "Sikkim • Himalayan Trail",
        weather: "11°C",
        listeners: "8,900+ travelers listened",
        time: "07:00 AM - 01:00 PM",
        crowd: "Clear mountain skies",
        duration: "03h 20m",
        distance: "6.5 km",
        image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80"
    },
    coastal: {
        title: "Old Goa Basilica & Latin Quarter",
        badge: "Goa • Coastal Heritage",
        weather: "31°C",
        listeners: "11,400+ travelers listened",
        time: "04:00 PM - 07:00 PM",
        crowd: "Golden hour walk",
        duration: "02h 10m",
        distance: "4.0 km",
        image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80"
    },
    sacred: {
        title: "Jagannath Temple & Grand Road",
        badge: "Puri • Sacred Trail",
        weather: "29°C",
        listeners: "19,500+ travelers listened",
        time: "05:30 AM - 08:30 AM",
        crowd: "Morning ritual hours",
        duration: "01h 30m",
        distance: "2.4 km",
        image: "https://images.unsplash.com/photo-1627894483216-2138af692e32?auto=format&fit=crop&w=900&q=80"
    },
    solo: {
        title: "Ghats of Old Varanasi",
        badge: "Varanasi • Living Culture",
        weather: "27°C",
        listeners: "16,800+ travelers listened",
        time: "05:00 AM - 08:00 AM",
        crowd: "Sunrise boat & walk",
        duration: "02h 00m",
        distance: "3.8 km",
        image: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=900&q=80"
    },
    hidden: {
        title: "Hampi Boulder Ruins",
        badge: "Karnataka • Ancient Trail",
        weather: "30°C",
        listeners: "9,300+ travelers listened",
        time: "06:30 AM - 10:30 AM",
        crowd: "Quiet sunrise trail",
        duration: "02h 45m",
        distance: "5.1 km",
        image: "https://images.unsplash.com/photo-1600100397608-f010f423b971?auto=format&fit=crop&w=900&q=80"
    }
};

const aiPromptBar = document.getElementById('aiPromptBar');
const exploreSpotBtn = document.getElementById('exploreSpotBtn');
const gridMenuBtn = document.getElementById('gridMenuBtn');
const categoryCards = document.querySelectorAll('.cat-card');

const spotImage = document.getElementById('spotImage');
const spotBadge = document.getElementById('spotBadge');
const spotWeather = document.getElementById('spotWeather');
const spotTitle = document.getElementById('spotTitle');
const spotListeners = document.getElementById('spotListeners');
const spotTime = document.getElementById('spotTime');
const spotCrowd = document.getElementById('spotCrowd');
const spotDuration = document.getElementById('spotDuration');
const spotDistance = document.getElementById('spotDistance');

if (aiPromptBar) {
    aiPromptBar.addEventListener('click', () => {
        window.location.href = '../ai-tour-guide/index.html';
    });
}

if (exploreSpotBtn) {
    exploreSpotBtn.addEventListener('click', () => {
        window.location.href = '../ai-tour-guide/index.html';
    });
}

if (gridMenuBtn) {
    gridMenuBtn.addEventListener('click', () => {
        window.location.href = '../dashboard/index.html';
    });
}

categoryCards.forEach(card => {
    card.addEventListener('click', () => {
        categoryCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const key = card.getAttribute('data-category');
        const data = spots[key];

        if (data) {
            spotImage.src = data.image;
            spotBadge.textContent = data.badge;
            spotWeather.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> ${data.weather}`;
            spotTitle.textContent = data.title;
            spotListeners.textContent = data.listeners;
            spotTime.textContent = data.time;
            spotCrowd.textContent = data.crowd;
            spotDuration.textContent = data.duration;
            spotDistance.textContent = data.distance;
        }
    });
});
const openAuthBtn = document.getElementById('openAuthBtn');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const authModal = document.getElementById('authModal');
const authBackdrop = document.getElementById('authBackdrop');
const authCard = document.getElementById('authCard');

const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const formLogin = document.getElementById('formLogin');
const formSignup = document.getElementById('formSignup');

function openAuth() {
    authModal.classList.remove('opacity-0', 'pointer-events-none');
    authCard.classList.remove('scale-95');
    authCard.classList.add('scale-100');
}

function closeAuth() {
    authModal.classList.add('opacity-0', 'pointer-events-none');
    authCard.classList.remove('scale-100');
    authCard.classList.add('scale-95');
}

if (openAuthBtn) openAuthBtn.addEventListener('click', openAuth);
if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuth);
if (authBackdrop) authBackdrop.addEventListener('click', closeAuth);

tabLogin.addEventListener('click', () => {
    tabLogin.classList.replace('text-sub', 'text-ink');
    tabLogin.classList.replace('font-medium', 'font-bold');
    tabLogin.classList.replace('border-transparent', 'border-ink');
    
    tabSignup.classList.replace('text-ink', 'text-sub');
    tabSignup.classList.replace('font-bold', 'font-medium');
    tabSignup.classList.replace('border-ink', 'border-transparent');
    
    formSignup.classList.replace('flex', 'hidden');
    formLogin.classList.replace('hidden', 'flex');
});

tabSignup.addEventListener('click', () => {
    tabSignup.classList.replace('text-sub', 'text-ink');
    tabSignup.classList.replace('font-medium', 'font-bold');
    tabSignup.classList.replace('border-transparent', 'border-ink');
    
    tabLogin.classList.replace('text-ink', 'text-sub');
    tabLogin.classList.replace('font-bold', 'font-medium');
    tabLogin.classList.replace('border-ink', 'border-transparent');
    
    formLogin.classList.replace('flex', 'hidden');
    formSignup.classList.replace('hidden', 'flex');
});

const googleSignInBtn = document.getElementById('googleSignInBtn');
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        const errorText = document.getElementById('googleAuthError');
        const originalContent = googleSignInBtn.innerHTML;
        errorText.hidden = true;
        googleSignInBtn.disabled = true;
        googleSignInBtn.textContent = 'Opening Google…';
        try {
            await window.VirasatAuth.signIn();
        } catch (error) {
            errorText.textContent = error.message;
            errorText.hidden = false;
            googleSignInBtn.disabled = false;
            googleSignInBtn.innerHTML = originalContent;
        }
    });
    // Restore the button when returning with the browser Back button.
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) window.location.reload();
    });
}
