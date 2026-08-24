// ==================== CONFIGURATION ====================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxMr-vh1AHg-rUhRccqqkJrWLhFgUQXzcH25PaInehjpZGHx1ovc9z9Zyn2nq1dvXFF/exec';

// Channel configurations (lastId ကို GAS ကနေ ယူမယ်)
const CHANNELS_BASE = {
    movie: {
        "M-Series (Channel-2)": {
            url: "https://t.me/+a_aB7iRBuZplNmU1",
            messageUrl: "https://t.me/c/3256993328/",
            displayName: "M-Series"
        },
        "M-Series (Channel-1)": {
            url: "https://t.me/+uSYLWyHjEFQ4ZGNl",
            messageUrl: "https://t.me/c/3401906030/",
            displayName: "M-Series"
        },
        "ရုပ်ရှင်ဇာတ်ကားကောင်းများ": {
            url: "https://t.me/+KMq-e-M-HN0xNDI9",
            messageUrl: "https://t.me/c/3462470280/",
            displayName: "M-Movie"
        },
        "Series ဇာတ်ကားကောင်းများ": {
            url: "https://t.me/+X8W27wwv2ps5MmI1",
            messageUrl: "https://t.me/c/3709172318/",
            displayName: "M-Movie"
        },
        "M-Movie မြန်မာစာတန်းထိုး ဇာတ်ကားကောင်းများ": {
            url: "https://t.me/+1QpAcGhp_ckyYzNl",
            messageUrl: "https://t.me/c/3293075476/",
            displayName: "M-Movie"
        }
    },
    animation: {
        "M-Animation (By M-Movie) မြန်မာစာတန်းထိုး ဇာတ်ကားကောင်းများ": {
            url: "https://t.me/+TmEtPpOmN-k3YzQ1",
            messageUrl: "https://t.me/c/3288425575/",
            displayName: "M-Movie"
        }
    }
};

let currentSelectedChannel = null;
let currentChannelType = 'movie';
let currentChannels = [];

// Store current form data for copy buttons
let currentMovieName = '';
let currentYear = '';
let currentVideoQuality = '';
let currentMessageId = '';
let currentChannelConfig = null;

// ==================== HELPER FUNCTIONS ====================
function formatWithPlus(text) {
    if (!text) return '';
    return text.toUpperCase().split('').join('+');
}

function formatSlugForHashtag(text, year) {
    if (!text) return '';
    let slug = text.trim().replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
    return `${slug}_${year}`;
}

// ==================== API CALLS ====================
function callAPI(action, params = {}, callback) {
    const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    
    const script = document.createElement('script');
    const url = new URL(GAS_API_URL);
    url.searchParams.append('action', action);
    url.searchParams.append('callback', callbackName);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        callback(null, data);
    };
    
    script.onerror = function() {
        delete window[callbackName];
        document.body.removeChild(script);
        callback(new Error('JSONP request failed'), null);
    };
    
    script.src = url.toString();
    document.body.appendChild(script);
}

function callAPIPromise(action, params = {}) {
    return new Promise((resolve, reject) => {
        callAPI(action, params, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

// ==================== CHANNEL FUNCTIONS ====================
async function loadChannels() {
    const type = document.querySelector('input[name="type"]:checked').value;
    currentChannelType = type;
    
    const container = document.getElementById('channelList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div> Loading channels...</div>';
    
    try {
        const result = await callAPIPromise('getChannels', { type: type });
        
        if (result && result.success && result.data) {
            currentChannels = result.data;
        } else {
            const baseChannels = type === 'movie' ? CHANNELS_BASE.movie : CHANNELS_BASE.animation;
            currentChannels = Object.keys(baseChannels).map(name => ({
                name: name,
                url: baseChannels[name].url,
                messageUrl: baseChannels[name].messageUrl,
                displayName: baseChannels[name].displayName,
                lastId: 0
            }));
        }
        
        displayChannelList();
        
    } catch (error) {
        console.error('Error loading channels:', error);
        showToast('Failed to load channels', 'error');
        
        const baseChannels = type === 'movie' ? CHANNELS_BASE.movie : CHANNELS_BASE.animation;
        currentChannels = Object.keys(baseChannels).map(name => ({
            name: name,
            url: baseChannels[name].url,
            messageUrl: baseChannels[name].messageUrl,
            displayName: baseChannels[name].displayName,
            lastId: 0
        }));
        displayChannelList();
    }
}

function displayChannelList() {
    const container = document.getElementById('channelList');
    container.innerHTML = '';
    
    currentChannels.forEach((channel, index) => {
        const div = document.createElement('div');
        div.className = 'channel-item';
        div.onclick = () => selectChannel(channel.name, index);
        
        const displayLastId = channel.lastId || 0;
        
        div.innerHTML = `
            <div class="channel-name">
                <span>📢 ${channel.name}</span>
                <span class="last-id-badge">Last ID: ${displayLastId}</span>
            </div>
            <div class="channel-url">${channel.url}</div>
            <div class="message-id-input">
                <label>Message ID:</label>
                <input type="number" id="msgId_${index}" placeholder="Enter message ID" 
                       value="${displayLastId + 1}" onclick="event.stopPropagation()">
            </div>
        `;
        container.appendChild(div);
    });
    
    if (currentChannels.length > 0) {
        selectChannel(currentChannels[0].name, 0);
    }
}

function selectChannel(name, index) {
    currentSelectedChannel = name;
    document.querySelectorAll('.channel-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    updateCurrentChannelConfig();
}

function getSelectedMessageId() {
    const selectedIndex = Array.from(document.querySelectorAll('.channel-item')).findIndex(
        item => item.classList.contains('selected')
    );
    if (selectedIndex === -1) return null;
    const input = document.getElementById(`msgId_${selectedIndex}`);
    return input ? input.value : null;
}

function getCurrentChannelConfig() {
    const type = document.querySelector('input[name="type"]:checked').value;
    const channels = type === 'movie' ? CHANNELS_BASE.movie : CHANNELS_BASE.animation;
    return channels[currentSelectedChannel];
}

function updateCurrentChannelConfig() {
    currentChannelConfig = getCurrentChannelConfig();
}

// ==================== POST GENERATION FUNCTIONS ====================
function getTelegramPostText(movieName, year, quality) {
    const formattedName = formatWithPlus(movieName);
    
    let qualityText = quality;
    if (quality === '720') qualityText = '720 P';
    if (quality === '1080') qualityText = '1080 P';
    if (quality === '4k') qualityText = '4K UHD';
    
    let post = `${formattedName} (${year})\n`;
    post += `Quality : ${qualityText}\n\n`;
    post += `⚠️ Copyright Disclaimer\n`;
    post += `No copyright infringement intended. I do not own any of the videos or music. \n`;
    post += `Use only for the entertainment purpose only under the principle of Fair Use. \n`;
    post += `All rights reserved goes to its rightful owner.`;
    
    return post;
}

function getFacebookPostText(movieName, year, channelConfig, messageId) {
    if (!channelConfig) return 'Please select a channel first!';
    
    const displayName = channelConfig.displayName || "M-Movie";
    const channelUrl = channelConfig.url;
    const messageUrl = channelConfig.messageUrl + messageId;
    const hashtagSlug = formatSlugForHashtag(movieName, year);
    
    let post = `${movieName} (${year}) ကို ${displayName} တွင်ကြည့်လို့ရပြီ။\n\n`;
    post += `ဇာတ်ကားကြည့်ရှုရန် Channel ကို Joinပါ👇🏼\n`;
    post += `${channelUrl}\n\n`;
    post += `Channel Join ပြီးပါက ဇာတ်ကားကြည့်ရှုရန် နှိပ်ပါ 👇🏼\n`;
    post += `🍿 ${messageUrl}\n\n`;
    post += `#${hashtagSlug}\n`;
    post += `#M_Movie\n`;
    post += `#MMSUB`;
    
    return post;
}

function updateCurrentValues() {
    currentMovieName = document.getElementById('movieName').value.trim();
    currentYear = document.getElementById('year').value.trim();
    currentVideoQuality = document.getElementById('videoQuality').value;
    currentMessageId = getSelectedMessageId();
    currentChannelConfig = getCurrentChannelConfig();
}

async function generatePost() {
    const movieName = document.getElementById('movieName').value.trim();
    const year = document.getElementById('year').value.trim();
    const type = document.querySelector('input[name="type"]:checked').value;
    const videoQuality = document.getElementById('videoQuality').value;
    const messageId = getSelectedMessageId();
    const channelConfig = getCurrentChannelConfig();
    
    if (!movieName) {
        showToast('Please enter movie name!', 'error');
        return;
    }
    if (!year || year.length !== 4 || isNaN(year)) {
        showToast('Please enter valid year (4 digits)!', 'error');
        return;
    }
    if (!currentSelectedChannel) {
        showToast('Please select a channel!', 'error');
        return;
    }
    if (!messageId) {
        showToast('Please enter message ID!', 'error');
        return;
    }
    
    currentMovieName = movieName;
    currentYear = year;
    currentVideoQuality = videoQuality;
    currentMessageId = messageId;
    currentChannelConfig = channelConfig;
    
    const telegramPost = getTelegramPostText(movieName, year, videoQuality);
    const facebookPost = getFacebookPostText(movieName, year, channelConfig, messageId);
    
    const previewText = `📱 TELEGRAM POST:\n${'='.repeat(50)}\n${telegramPost}\n\n\n📘 FACEBOOK POST:\n${'='.repeat(50)}\n${facebookPost}`;
    document.getElementById('previewText').innerText = previewText;
    document.getElementById('previewArea').style.display = 'block';
    
    const btn = document.getElementById('generateBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Saving...';
    btn.disabled = true;
    
    try {
        const result = await callAPIPromise('savePost', {
            movieName: movieName,
            year: year,
            type: type,
            channel: currentSelectedChannel,
            videoQuality: videoQuality,
            messageId: messageId
        });
        
        if (result && result.success) {
            showToast('✅ Post saved successfully! Last ID updated automatically.');
            await loadChannels();
            loadAllPosts();
            document.getElementById('movieName').value = '';
            document.getElementById('year').value = '';
            currentMovieName = '';
            currentYear = '';
            currentMessageId = '';
            currentChannelConfig = null;
        } else {
            showToast('❌ Error: ' + (result?.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showToast('❌ Network error: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function copyToClipboard() {
    const text = document.getElementById('previewText').innerText;
    if (!text || text.includes('No preview')) {
        showToast('Please generate a post first!', 'error');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Both posts copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function copyTelegramOnly() {
    if (!currentMovieName || !currentYear) {
        updateCurrentValues();
    }
    
    if (!currentMovieName || !currentYear) {
        showToast('Please generate a post first!', 'error');
        return;
    }
    
    const telegramPost = getTelegramPostText(currentMovieName, currentYear, currentVideoQuality);
    navigator.clipboard.writeText(telegramPost).then(() => {
        showToast('📱 Telegram post copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function copyFacebookOnly() {
    if (!currentMovieName || !currentYear) {
        updateCurrentValues();
    }
    
    if (!currentMovieName || !currentYear) {
        showToast('Please generate a post first!', 'error');
        return;
    }
    
    if (!currentMessageId) {
        currentMessageId = getSelectedMessageId();
    }
    
    if (!currentChannelConfig) {
        currentChannelConfig = getCurrentChannelConfig();
    }
    
    if (!currentMessageId) {
        showToast('Please enter message ID!', 'error');
        return;
    }
    
    if (!currentChannelConfig) {
        showToast('Please select a channel!', 'error');
        return;
    }
    
    const facebookPost = getFacebookPostText(currentMovieName, currentYear, currentChannelConfig, currentMessageId);
    navigator.clipboard.writeText(facebookPost).then(() => {
        showToast('📘 Facebook post copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// ==================== SEARCH & DISPLAY ====================
async function searchPosts() {
    const query = document.getElementById('searchInput').value.trim();
    if (query === '') {
        loadAllPosts();
        return;
    }
    
    try {
        const result = await callAPIPromise('searchPosts', { query: query });
        if (result && result.success) {
            displayPosts(result.data || []);
        } else {
            displayPosts([]);
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed: ' + error.message, 'error');
    }
}

async function loadAllPosts() {
    const container = document.getElementById('postsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div> Loading posts...</div>';
    
    try {
        const result = await callAPIPromise('getAllPosts');
        if (result && result.success) {
            displayPosts(result.data || []);
        } else {
            container.innerHTML = '<div class="loading">📭 No posts found</div>';
        }
    } catch (error) {
        console.error('Load error:', error);
        container.innerHTML = '<div class="loading">❌ Failed to load posts: ' + error.message + '</div>';
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsList');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="loading">📭 No posts found</div>';
        return;
    }
    
    container.innerHTML = '';
    posts.forEach(post => {
        let messageUrl = '';
        let channelUrl = '';
        let displayName = '';
        let channelMessageUrl = '';
        
        if (post.type === 'movie' && CHANNELS_BASE.movie[post.channel]) {
            messageUrl = CHANNELS_BASE.movie[post.channel].messageUrl + post.messageId;
            channelUrl = CHANNELS_BASE.movie[post.channel].url;
            displayName = CHANNELS_BASE.movie[post.channel].displayName;
            channelMessageUrl = CHANNELS_BASE.movie[post.channel].messageUrl;
        } else if (post.type === 'animation' && CHANNELS_BASE.animation[post.channel]) {
            messageUrl = CHANNELS_BASE.animation[post.channel].messageUrl + post.messageId;
            channelUrl = CHANNELS_BASE.animation[post.channel].url;
            displayName = CHANNELS_BASE.animation[post.channel].displayName;
            channelMessageUrl = CHANNELS_BASE.animation[post.channel].messageUrl;
        }
        
        const div = document.createElement('div');
        div.className = 'post-item';
        div.innerHTML = `
            <div class="post-title">🎬 ${escapeHtml(post.movieName)} (${post.year})</div>
            <div class="post-details">
                <span>📺 ${post.videoQuality}P</span>
                <span>📢 ${escapeHtml(post.channel)}</span>
                <span>🆔 ID: ${post.messageId}</span>
                <span>📅 ${post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="post-actions" style="flex-wrap: wrap;">
                <button class="btn btn-copy" onclick="viewPostMessage('${messageUrl}', '${escapeHtml(post.movieName)}')">🔗 View Message</button>
                <button class="btn btn-copy" onclick="copySavedPostBoth('${escapeHtml(post.movieName)}', '${post.year}', '${post.videoQuality}', '${channelUrl}', '${channelMessageUrl}', '${displayName}', '${post.messageId}')">📋 Copy Both</button>
                <button class="btn btn-copy" style="background: #0088cc;" onclick="copySavedPostTelegram('${escapeHtml(post.movieName)}', '${post.year}', '${post.videoQuality}')">📱 Copy Telegram</button>
                <button class="btn btn-copy" style="background: #1877f2;" onclick="copySavedPostFacebook('${escapeHtml(post.movieName)}', '${post.year}', '${channelUrl}', '${channelMessageUrl}', '${displayName}', '${post.messageId}')">📘 Copy Facebook</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Copy saved post functions for search results
function copySavedPostBoth(movieName, year, quality, channelUrl, channelMessageUrl, displayName, messageId) {
    const telegramPost = getTelegramPostText(movieName, year, quality);
    const channelConfig = {
        displayName: displayName || "M-Movie",
        url: channelUrl,
        messageUrl: channelMessageUrl
    };
    const facebookPost = getFacebookPostText(movieName, year, channelConfig, messageId);
    
    const fullText = `📱 TELEGRAM POST:\n${'='.repeat(50)}\n${telegramPost}\n\n\n📘 FACEBOOK POST:\n${'='.repeat(50)}\n${facebookPost}`;
    
    navigator.clipboard.writeText(fullText).then(() => {
        showToast('📋 Both posts copied to clipboard!');
    });
}

function copySavedPostTelegram(movieName, year, quality) {
    const telegramPost = getTelegramPostText(movieName, year, quality);
    navigator.clipboard.writeText(telegramPost).then(() => {
        showToast('📱 Telegram post copied to clipboard!');
    });
}

function copySavedPostFacebook(movieName, year, channelUrl, channelMessageUrl, displayName, messageId) {
    const channelConfig = {
        displayName: displayName || "M-Movie",
        url: channelUrl,
        messageUrl: channelMessageUrl
    };
    const facebookPost = getFacebookPostText(movieName, year, channelConfig, messageId);
    navigator.clipboard.writeText(facebookPost).then(() => {
        showToast('📘 Facebook post copied to clipboard!');
    });
}

function viewPostMessage(url, movieName) {
    if (url && url !== 'undefined') {
        window.open(url, '_blank');
    } else {
        showToast('Message URL not available', 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.innerText = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('videoQuality').value = this.dataset.quality;
            if (currentMovieName) {
                currentVideoQuality = this.dataset.quality;
            }
        });
    });
    document.querySelector('.quality-btn').classList.add('selected');

    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            loadChannels();
        });
    });
    
    document.getElementById('movieName').addEventListener('input', function() {
        currentMovieName = this.value.trim();
    });
    document.getElementById('year').addEventListener('input', function() {
        currentYear = this.value.trim();
    });

    loadChannels();
    loadAllPosts();
});