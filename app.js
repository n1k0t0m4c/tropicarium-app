// ==================== CONFIGURATION ====================
const API_URL = "https://script.google.com/macros/s/AKfycbwc0Zn8q8bhXlmPQo6ovOUhMjnvH3FIr5hfXV9N6bKYrgKL9p9PJD3PP_MjJb6R0nziSw/exec";

// ==================== STATE MANAGEMENT ====================
let appState = {
    videos: [],
    isLoading: true,
    isSaving: false,
    usesMockData: false,
    expandedMonths: {},
    currentFormMonth: null,
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
     console.log('Initializing Content Pipeline Manager...');
     console.log('API_URL:', API_URL);
     
     updateSyncStatus('Initializing...');
     
     // POPRAVEK: Preverimo le, če je URL sploh vpisan ali če je ostal generičen tekst
     const isApiConfigured = API_URL && API_URL.trim() !== "" && !API_URL.includes("TVOJ_URL_SEM");
     
     if (!isApiConfigured) {
         console.warn('API_URL is not configured. Using mock data for demonstration.');
         appState.usesMockData = true;
         loadMockData();
         setTimeout(() => {
             renderUI();
             hideLoadingPage();
             showErrorState();
             updateSyncStatus('Not configured');
         }, 1500);
     } else {
         try {
             console.log('Fetching videos from API...');
             await fetchVideosFromAPI();
             console.log('Successfully fetched videos:', appState.videos.length);
             renderUI();
             hideLoadingPage();
             hideErrorState();
             updateSyncStatus('Synced: ' + appState.videos.length + ' items');
         } catch (error) {
             console.error('Failed to fetch from API:', error);
             appState.usesMockData = true;
             loadMockData();
             setTimeout(() => {
                 renderUI();
                 hideLoadingPage();
                 
                 const errorBox = document.getElementById('errorState');
                 if (errorBox) {
                     errorBox.querySelector('h3').textContent = "Povezava z Google Sheets je spodletela";
                     errorBox.querySelector('p').innerHTML = 
                         "URL je nastavljen, vendar brskalnik ne more prejeti podatkov. <br>" +
                         "1. Preveri, ali je Google Script objavljen kot <b>Web App</b>.<br>" +
                         "2. Nastavitev 'Who has access' mora biti nastavljena na <b>Anyone</b>.<br>" +
                         "3. Odpri konzolo (F12 -> Console) za natančen opis napake.";
                 }
                 showErrorState();
                 updateSyncStatus('Connection failed');
             }, 1500);
         }
     }
 }

 function updateSyncStatus(message) {
     const syncStatus = document.getElementById('syncStatus');
     if (syncStatus) {
         syncStatus.textContent = message;
     }
 }

 function showRefreshOverlay() {
     const overlay = document.getElementById('refreshOverlay');
     if (!overlay) return;
     overlay.classList.remove('finishing');
     overlay.classList.add('active');
 }

 function hideRefreshOverlay() {
     const overlay = document.getElementById('refreshOverlay');
     if (!overlay) return;
     overlay.classList.add('finishing');
     overlay.classList.remove('active');
     setTimeout(() => {
         overlay.classList.remove('finishing');
     }, 550);
 }

 async function refreshData() {
     console.log('Manual refresh triggered');
     updateSyncStatus('Refreshing...');
     showRefreshOverlay();
     const contentArea = document.getElementById('contentArea');
     contentArea.style.opacity = '0.5';
     contentArea.style.transform = 'scale(0.985)';
     contentArea.style.transition = 'opacity 0.35s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
     
     try {
         await fetchVideosFromAPI();
         renderUI();
         updateSyncStatus('Synced: ' + appState.videos.length + ' items');
         console.log('Refresh successful');
     } catch (error) {
         console.error('Refresh failed:', error);
         updateSyncStatus('Refresh failed - check console');
     } finally {
         contentArea.style.opacity = '1';
         contentArea.style.transform = 'scale(1)';
         hideRefreshOverlay();
     }
 }

// ==================== API FUNCTIONS ====================
 async function fetchVideosFromAPI() {
     try {
        const cacheBuster = API_URL.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
        const response = await fetch(API_URL + cacheBuster);

         if (!response.ok) {
             throw new Error(`API error: ${response.status}`);
         }

         const responseText = await response.text();
         console.log('API Response:', responseText);

         let data;
         try {
             data = JSON.parse(responseText);
         } catch (parseError) {
             console.error('Failed to parse JSON response:', parseError);
             console.error('Response text was:', responseText);
             throw new Error('Invalid JSON response from API');
         }

         console.log('Parsed data:', data);
         console.log('Data type:', typeof data, 'Is array:', Array.isArray(data));

         let videos = [];
         if (Array.isArray(data)) {
             videos = data;
         } else if (data && typeof data === 'object') {
             if (data.videos && Array.isArray(data.videos)) {
                 videos = data.videos;
             } else if (data.data && Array.isArray(data.data)) {
                 videos = data.data;
             } else if (data.result && Array.isArray(data.result)) {
                 videos = data.result;
             } else {
                 console.warn('Could not find videos array in response object:', data);
                 videos = [];
             }
         }

         appState.videos = videos.map(normalizeVideo);
         appState.isLoading = false;
     } catch (error) {
         console.error('API fetch failed:', error);
         throw error;
     }
 }

async function saveVideoToAPI(video) {
    if (appState.usesMockData) {
        return true;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // This exact string tricks the browser into skipping the OPTIONS preflight
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(video)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Failed to save video to API:', error);
        return false;
    }
}

 async function updateVideoFields(id, fields) {
     const existingVideo = appState.videos.find(v => v.id === id);
     if (!existingVideo) return false;

     const updatedVideo = normalizeVideo({
         ...existingVideo,
         ...fields,
         id: existingVideo.id,
         createdAt: existingVideo.createdAt || new Date().toISOString()
     });

     if (appState.usesMockData) {
         Object.assign(existingVideo, updatedVideo);
         return true;
     }

     try {
         const deleteResponse = await fetch(API_URL, {
             method: 'POST',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' },
             body: JSON.stringify({ action: 'delete', id: id })
         });

         if (!deleteResponse.ok) {
             throw new Error(`Delete failed: ${deleteResponse.status}`);
         }

         const saveResponse = await fetch(API_URL, {
             method: 'POST',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' },
             body: JSON.stringify(updatedVideo)
         });

         if (!saveResponse.ok) {
             throw new Error(`Save failed: ${saveResponse.status}`);
         }

         Object.assign(existingVideo, updatedVideo);
         return true;
     } catch (error) {
         console.error('Failed to replace video:', error);
         return false;
     }
 }

 async function deleteVideo(id) {
     // 1. The "Are you sure?" Popup
     if (!confirm("Are you sure you want to delete this idea? This cannot be undone.")) {
         return; 
     }

     // 2. Make the card look faded while deleting
     const cardElement = document.getElementById('card-' + id);
     if (cardElement) cardElement.style.opacity = '0.5';

     try {
         // 3. Tell Google Sheets to delete it
         const response = await fetch(API_URL, {
             method: 'POST',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' },
             body: JSON.stringify({ action: 'delete', id: id })
         });

         if (!response.ok) throw new Error("Delete failed");

         // 4. Remove it from the local screen and refresh the UI
         appState.videos = appState.videos.filter(v => v.id !== id);
         renderUI();
         updateSyncStatus('Deleted ✓');
         
         setTimeout(() => {
             console.log('Auto-refreshing data after delete...');
             refreshData();
         }, 500);

     } catch (error) {
         console.error('Failed to delete:', error);
         alert('Failed to delete the video. Please try again.');
         if (cardElement) cardElement.style.opacity = '1';
     }
 }

// ==================== MOCK DATA ====================
function loadMockData() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    appState.videos = [
        {
            id: '1',
            title: 'Getting Started with React Hooks',
            type: 'Long',
            month: getMonthName(currentMonth) + ' ' + currentYear,
            link: 'https://react.dev',
            driveLink: '',
            caption: 'A comprehensive guide to understanding React Hooks',
            script: 'In this video, we will explore the fundamentals of React Hooks...',
            stars: 3,
            createdAt: new Date().toISOString()
        },
        {
            id: '2',
            title: 'CSS Grid Basics',
            type: 'Short',
            month: getMonthName(currentMonth) + ' ' + currentYear,
            link: 'https://developer.mozilla.org/css-grid',
            driveLink: '',
            caption: 'Learn CSS Grid in 10 seconds',
            script: 'CSS Grid allows us to create two-dimensional layouts...',
            stars: 2,
            createdAt: new Date().toISOString()
        },
        {
            id: '3',
            title: 'JavaScript Async/Await',
            type: 'Long',
            month: getMonthName((currentMonth + 1) % 12) + ' ' + (currentMonth === 11 ? currentYear + 1 : currentYear),
            link: 'https://javascript.info',
            driveLink: '',
            caption: 'Master asynchronous JavaScript',
            script: 'Async and await syntax makes promises easier to work with...',
            stars: 3,
            createdAt: new Date().toISOString()
        },
        {
            id: '4',
            title: 'Tailwind CSS Tips',
            type: 'Short',
            month: getMonthName((currentMonth + 1) % 12) + ' ' + (currentMonth === 11 ? currentYear + 1 : currentYear),
            link: 'https://tailwindcss.com',
            driveLink: '',
            caption: 'Quick tips for productivity',
            script: 'Tailwind utilities can be combined for powerful designs...',
            stars: 1,
            createdAt: new Date().toISOString()
        }
    ];

    appState.isLoading = false;
}

// ==================== UTILITY FUNCTIONS ====================
 function getMonthName(monthIndex) {
     const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
     return monthNames[monthIndex % 12];
 }

 function formatMonthValue(monthValue) {
     if (!monthValue) return '';
     if (typeof monthValue === 'string' && /^[A-Za-z]+\s+\d{4}$/.test(monthValue.trim())) {
         return monthValue.trim();
     }

     const date = new Date(monthValue);
     if (!Number.isNaN(date.getTime())) {
         date.setHours(date.getHours() + 12);
         return getMonthName(date.getMonth()) + ' ' + date.getFullYear();
     }

     return String(monthValue).trim();
 }

 function normalizeVideo(video) {
     return {
         ...video,
         month: formatMonthValue(video.month),
         type: String(video.type || '').trim(),
         stars: parseInt(video.stars) || 1
     };
 }

 function getUpcomingMonths(count = 4) {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const monthName = getMonthName(date.getMonth());
        const year = date.getFullYear();
        months.push({
            name: monthName,
            year: year,
            display: `${monthName} ${year}`,
            index: date.getMonth(),
            fullDate: date
        });
    }

    return months;
}

function getCountByType(videos, type) {
    return videos.filter(v => v.type === type).length;
}

function getVideosByMonth(monthDisplay) {
    return appState.videos.filter(v => formatMonthValue(v.month) === monthDisplay);
}

function getStarColor(stars) {
    if (stars === 3) return 'text-red-500'; // Must Do
    if (stars === 2) return 'text-orange-500'; // Maybe
    return 'text-gray-400'; // Just an Idea
}

function getStarLabel(stars) {
    if (stars === 3) return 'Must Do';
    if (stars === 2) return 'Maybe';
    return 'Just an Idea';
}

function extractGoogleDriveFileId(url) {
    if (!url) return null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9-_]+)\//,
        /id=([a-zA-Z0-9-_]+)/,
        /\/d\/([a-zA-Z0-9-_]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

 // ==================== UI RENDERING ====================
 function renderUI() {
     const contentArea = document.getElementById('contentArea');
     const loadingState = document.getElementById('loadingState');
     
     loadingState.classList.add('hidden');
     contentArea.classList.remove('hidden');

     const months = getUpcomingMonths(4);
     contentArea.innerHTML = '';

     months.forEach(month => {
         const monthDisplay = month.display;
         const monthVideos = getVideosByMonth(monthDisplay);
         const longCount = getCountByType(monthVideos, 'Long');
         const shortCount = getCountByType(monthVideos, 'Short');
         const isExpanded = appState.expandedMonths[monthDisplay] || false;

        const monthSection = document.createElement('div');
        monthSection.className = 'bg-gradient-to-b from-[#050805] to-[#061006] rounded-xl border border-green-900/30 shadow-lg overflow-hidden glow-box';

        const header = document.createElement('div');
        header.className = 'collapsible-header p-4 sm:p-5 flex justify-between items-center bg-gradient-to-r from-[#071107] to-[#061006] border-b border-green-900/30';
        header.onclick = () => toggleMonth(monthDisplay, monthSection);

        const headerLeft = document.createElement('div');
        headerLeft.className = 'flex-1 min-w-0';

        const title = document.createElement('h2');
        title.className = 'text-lg sm:text-xl font-bold text-green-400 glow-text';
        title.textContent = `${monthDisplay}`;

        const badge = document.createElement('p');
        badge.className = 'text-xs sm:text-sm text-green-300/70 mt-1';
        badge.textContent = `${longCount} Long, ${shortCount} Short`;

        headerLeft.appendChild(title);
        headerLeft.appendChild(badge);

        const headerRight = document.createElement('div');
        headerRight.className = 'flex gap-2 sm:gap-3 items-center ml-3 flex-shrink-0';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add px-3 sm:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-500 hover:to-emerald-500 transition font-semibold text-xs sm:text-sm floating-tab';
        addBtn.innerHTML = '<span class="text-lg leading-none">+</span>';
        addBtn.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.4)';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            openVideoModal(monthDisplay);
        };

        const toggleIcon = document.createElement('span');
        toggleIcon.className = `toggle-icon text-lg font-light ${isExpanded ? 'open' : ''}`;
        toggleIcon.textContent = '▼';
        toggleIcon.style.display = 'block';

        headerRight.appendChild(addBtn);
        headerRight.appendChild(toggleIcon);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'collapsible-content ' + (isExpanded ? 'open' : '');

        if (monthVideos.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'p-6 sm:p-8 text-center text-green-300/60';
            emptyState.innerHTML = '<p class="text-sm sm:text-base">No ideas yet. Click "+" to add one! 🌱</p>';
            contentContainer.appendChild(emptyState);
        } else {
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-6';

            monthVideos.forEach(video => {
                cardsContainer.appendChild(createVideoCard(video));
            });

            contentContainer.appendChild(cardsContainer);
        }

        monthSection.appendChild(header);
        monthSection.appendChild(contentContainer);
        contentArea.appendChild(monthSection);

        // If already expanded (e.g. after refresh), set height to auto immediately
        // so the section renders open without an unwanted opening animation
        if (isExpanded) {
            contentContainer.style.height = 'auto';
        }
    });
}
   
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'bg-gradient-to-b from-[#050805] to-[#061006] rounded-xl border border-green-900/30 p-4 sm:p-5 hover:shadow-lg transition glow-hover';
    card.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.15)';

    // Add ID to the card so we can target it for the fading animation
    card.id = 'card-' + video.id;

    // Create a top row container for the Title + Delete button
    const topRow = document.createElement('div');
    topRow.className = 'flex justify-between items-start mb-2 gap-2';

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.className = 'text-red-400/70 hover:text-red-400 transition bg-red-900/20 hover:bg-red-900/40 rounded p-1.5 text-xs';
    deleteBtn.onclick = () => deleteVideo(video.id);

    const titleEl = document.createElement('h3');
    // (mb-2 je uspešno odstranjen iz className, tako kot ti je svetoval AI!)
    titleEl.className = 'font-bold text-sm sm:text-base text-green-400 card-title line-clamp-2 glow-text';
    titleEl.textContent = video.title;

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'flex gap-2 mb-3 flex-wrap';

    const typeBadge = document.createElement('span');
    typeBadge.className = `text-xs font-semibold px-2 py-1 rounded floating-tab ${
        video.type === 'Long' 
            ? 'bg-gradient-to-r from-green-950/70 to-lime-950/50 text-lime-300 border border-lime-900/50' 
            : 'bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-300 border border-green-900/50'
    }`;
    typeBadge.textContent = video.type === 'Long' ? 'Long (25s)' : 'Short (10s)';

    const starContainer = document.createElement('div');
    starContainer.className = 'flex gap-0.5 items-center';
    for (let i = 0; i < 3; i++) {
        const star = document.createElement('span');
        star.className = `star ${i < video.stars ? getStarColor(video.stars) : 'empty'}`;
        star.textContent = '★';
        starContainer.appendChild(star);
    }

    badgesContainer.appendChild(typeBadge);

    const linkButton = document.createElement('a');
    linkButton.href = video.link || '#';
    linkButton.target = '_blank';
    linkButton.rel = 'noopener noreferrer';
    linkButton.className = `text-xs font-semibold px-2 py-1 rounded floating-tab ${
        !video.link ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
    }`;
    linkButton.innerHTML = '🔗';
    badgesContainer.appendChild(linkButton);

    const starsLabel = document.createElement('span');
    starsLabel.className = 'text-xs text-green-300/70 font-medium';
    starsLabel.innerHTML = starContainer.innerHTML + ' ' + getStarLabel(video.stars);

    let driveVideoSection = null;
    if (video.driveLink && video.driveLink.trim()) {
        const fileId = extractGoogleDriveFileId(video.driveLink);
        if (fileId) {
            driveVideoSection = document.createElement('div');
            driveVideoSection.className = 'mt-3 w-full';
            const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            driveVideoSection.innerHTML = `
                <iframe 
                    src="${embedUrl}" 
                    class="w-full rounded-lg border border-green-900/30" 
                    style="height: 200px; min-height: 200px; box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);"
                    allow="autoplay" 
                    allowfullscreen
                ></iframe>
            `;
        }
    }

    const caption = document.createElement('div');
    caption.className = 'mt-3 border-t border-green-900/30 pt-3';

    const captionHeader = document.createElement('button');
    captionHeader.className = 'w-full text-left text-xs sm:text-sm font-semibold text-green-400 flex justify-between items-center hover:text-green-300 transition';
    captionHeader.innerHTML = '<span>Caption</span><span class="text-green-500/60">▼</span>';
    captionHeader.onclick = (e) => toggleCollapsible(e, caption);

    const captionContent = document.createElement('div');
    captionContent.className = 'collapsible-content mt-2';
    const captionTextarea = document.createElement('textarea');
    captionTextarea.className = 'editable-field w-full px-3 py-3 text-xs sm:text-sm text-green-300/80 focus:outline-none transition';
    captionTextarea.value = video.caption || '';
    captionTextarea.placeholder = 'No caption';
    const captionSaveBtn = document.createElement('button');
    captionSaveBtn.className = 'mt-2 px-3 py-2 text-xs font-semibold rounded floating-tab';
    captionSaveBtn.textContent = 'Save Caption';
    captionSaveBtn.onclick = () => saveEditableField(video.id, 'caption', captionTextarea.value, captionSaveBtn);
    captionContent.appendChild(captionTextarea);
    captionContent.appendChild(captionSaveBtn);

    caption.appendChild(captionHeader);
    caption.appendChild(captionContent);

    const script = document.createElement('div');
    script.className = 'mt-3 border-t border-green-900/30 pt-3';

    const scriptHeader = document.createElement('button');
    scriptHeader.className = 'w-full text-left text-xs sm:text-sm font-semibold text-green-400 flex justify-between items-center hover:text-green-300 transition';
    scriptHeader.innerHTML = '<span>Script</span><span class="text-green-500/60">▼</span>';
    scriptHeader.onclick = (e) => toggleCollapsible(e, script);

    const scriptContent = document.createElement('div');
    scriptContent.className = 'collapsible-content mt-2';
    const scriptTextarea = document.createElement('textarea');
    scriptTextarea.className = 'editable-field w-full px-3 py-3 text-xs sm:text-sm text-green-300/80 focus:outline-none transition';
    scriptTextarea.value = video.script || '';
    scriptTextarea.placeholder = 'No script';
    scriptTextarea.style.minHeight = '150px';
    const scriptSaveBtn = document.createElement('button');
    scriptSaveBtn.className = 'mt-2 px-3 py-2 text-xs font-semibold rounded floating-tab';
    scriptSaveBtn.textContent = 'Save Script';
    scriptSaveBtn.onclick = () => saveEditableField(video.id, 'script', scriptTextarea.value, scriptSaveBtn);
    scriptContent.appendChild(scriptTextarea);
    scriptContent.appendChild(scriptSaveBtn);

    script.appendChild(scriptHeader);
    script.appendChild(scriptContent);

    topRow.appendChild(titleEl);
    topRow.appendChild(deleteBtn);
    card.appendChild(topRow);            
    card.appendChild(badgesContainer);
    card.appendChild(starsLabel);
    if (driveVideoSection) {
        card.appendChild(driveVideoSection);
    }
    card.appendChild(caption);
    card.appendChild(script);

    return card;
}

async function saveEditableField(id, field, value, button) {
    const originalText = button.textContent;
    button.textContent = 'Saving...';
    button.disabled = true;
    updateSyncStatus('Saving edit...');

    const saved = await updateVideoFields(id, { [field]: value });

    if (saved) {
        button.textContent = 'Saved ✓';
        updateSyncStatus('Saved ✓');
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            refreshData();
        }, 1200);
    } else {
        button.textContent = originalText;
        button.disabled = false;
        updateSyncStatus('Save failed');
        alert('Failed to save changes. Please try again.');
    }
}

// ==================== SMOOTH COLLAPSIBLE ANIMATION ====================
// Uses precise JS-measured pixel heights so both directions take the same
// real time, with tailored easings: expo-out for opening, smooth-in for closing.

function animateOpen(content) {
    // 1. Disable transition, measure natural height
    content.style.transition = 'none';
    content.style.height = 'auto';
    const targetHeight = content.scrollHeight;
    content.style.height = '0px';

    // 2. Force layout so browser commits the 0px start
    void content.offsetHeight;

    // 3. Apply opening transitions (Expo-out: starts fast, decelerates elegantly)
    content.style.transition = [
        'height 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
    ].join(', ');

    // 4. Animate to real content height
    content.style.height = targetHeight + 'px';
    content.classList.add('open');

    // 5. After height animation, switch to 'auto' so content can grow freely
    function onEnd(e) {
        if (e.propertyName === 'height' && e.target === content) {
            content.style.height = 'auto';
            content.removeEventListener('transitionend', onEnd);
        }
    }
    content.addEventListener('transitionend', onEnd);
}

function animateClose(content) {
    // 1. Capture current rendered height (works even if height is 'auto')
    const currentHeight = content.offsetHeight;

    // 2. Pin it as an explicit px value so transition has a defined start
    content.style.transition = 'none';
    content.style.height = currentHeight + 'px';

    // 3. Force layout
    void content.offsetHeight;

    // 4. Apply closing transitions (ease-in: starts smooth, ends crisply)
    content.style.transition = [
        'height 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
        'opacity 0.3s cubic-bezier(0.4, 0, 1, 1)',
        'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)'
    ].join(', ');

    // 5. Animate to zero
    content.style.height = '0px';
    content.classList.remove('open');
}

function toggleCollapsible(e, element) {
    e.preventDefault();
    e.stopPropagation();
    const content = element.querySelector('.collapsible-content');
    const icon = element.querySelector('span:last-child');

    if (content.classList.contains('open')) {
        animateClose(content);
        icon.textContent = '▼';
    } else {
        animateOpen(content);
        icon.textContent = '▲';
    }
}

function toggleMonth(monthDisplay, monthSection) {
    const isExpanded = appState.expandedMonths[monthDisplay];
    appState.expandedMonths[monthDisplay] = !isExpanded;

    const content = monthSection.querySelector('.collapsible-content');
    const icon = monthSection.querySelector('.toggle-icon');

    if (isExpanded) {
        animateClose(content);
        icon.classList.remove('open');
    } else {
        animateOpen(content);
        icon.classList.add('open');
    }
}

// ==================== MODAL FUNCTIONS ====================
function openVideoModal(monthDisplay) {
    appState.currentFormMonth = monthDisplay;
    document.getElementById('formMonth').value = monthDisplay;
    document.getElementById('videoForm').reset();
    document.getElementById('formStars').value = '1';
    document.getElementById('formType').checked = false;
    updateTypeLabel();
    updateStarDescription();

    const modal = document.getElementById('videoModal');
    modal.classList.remove('hidden', 'modal-closing');
    document.body.style.overflow = 'hidden';

    // Two rAFs: first lets display:flex paint at opacity 0,
    // second triggers the CSS transition into modal-visible
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
        });
    });
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    // Ignore if already closing or hidden
    if (!modal.classList.contains('modal-visible')) return;

    modal.classList.add('modal-closing');
    modal.classList.remove('modal-visible');
    document.body.style.overflow = '';
    document.getElementById('videoForm').reset();

    // Wait for closing animation (longest property: 260ms) then fully hide
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-closing');
    }, 300);
}

function updateTypeLabel() {
    const isLong = document.getElementById('formType').checked;
    const shortLabel = document.getElementById('shortLabel');
    const longLabel = document.getElementById('longLabel');

    if (isLong) {
        shortLabel.classList.remove('active');
        longLabel.classList.add('active');
    } else {
        shortLabel.classList.add('active');
        longLabel.classList.remove('active');
    }
}

function setStarRating(rating) {
    document.getElementById('formStars').value = rating;
    updateStarDescription();
}

function updateStarDescription() {
    const stars = parseInt(document.getElementById('formStars').value);
    const label = getStarLabel(stars);
    document.getElementById('starDescription').textContent = label;

    document.querySelectorAll('.star-btn').forEach((btn, index) => {
        const star = btn.querySelector('.star');
        if (index < stars) {
            star.classList.remove('empty');
            star.className = `star ${getStarColor(stars)}`;
        } else {
            star.classList.add('empty');
        }
    });
}

 // ==================== FORM SUBMISSION ====================
 document.addEventListener('DOMContentLoaded', () => {
     document.getElementById('videoForm').addEventListener('submit', async (e) => {
         e.preventDefault();

         if (appState.isSaving) return;

         appState.isSaving = true;
         const submitBtn = document.getElementById('submitBtn');
         const originalText = submitBtn.textContent;
         submitBtn.textContent = 'Saving...';
         submitBtn.disabled = true;

         const newVideo = {
             id: 'video_' + Date.now(),
             title: document.getElementById('formTitle').value,
             type: document.getElementById('formType').checked ? 'Long' : 'Short',
             month: document.getElementById('formMonth').value,
             link: document.getElementById('formLink').value,
             driveLink: document.getElementById('formDriveLink').value,
             caption: document.getElementById('formCaption').value,
             script: document.getElementById('formScript').value,
             stars: parseInt(document.getElementById('formStars').value),
             createdAt: new Date().toISOString()
         };

         const saved = await saveVideoToAPI(newVideo);

         if (saved) {
             appState.videos.push(newVideo);
             renderUI();
             closeVideoModal();
             submitBtn.textContent = originalText;
             submitBtn.disabled = false;
             appState.isSaving = false;
             updateSyncStatus('Saved ✓');
             setTimeout(() => {
                 updateSyncStatus('Synced: ' + appState.videos.length + ' items');
             }, 2000);
             
             setTimeout(() => {
                 console.log('Auto-refreshing data to verify save...');
                 refreshData();
             }, 500);
         } else {
             submitBtn.textContent = originalText;
             submitBtn.disabled = false;
             appState.isSaving = false;
             alert('Failed to save video. Please try again.');
         }
     });

     // ==================== ERROR HANDLING ====================
     // Close modal on outside click
     document.getElementById('videoModal').addEventListener('click', (e) => {
         if (e.target === document.getElementById('videoModal')) {
             closeVideoModal();
         }
     });

     // Prevent body scroll when modal is open
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape' && !document.getElementById('videoModal').classList.contains('hidden')) {
             closeVideoModal();
         }
     });
 });

// ==================== ERROR HANDLING ====================
function showErrorState() {
    document.getElementById('errorState').classList.remove('hidden');
}

function hideErrorState() {
    document.getElementById('errorState').classList.add('hidden');
}

function hideLoadingPage() {
    const loadingPage = document.getElementById('loadingPageOverlay');
    const appShell = document.getElementById('appShell');
    loadingPage.classList.add('zoom-out');
    appShell.classList.add('app-visible');
    setTimeout(() => {
        loadingPage.style.display = 'none';
    }, 700);
}
