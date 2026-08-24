// ==================== CONFIGURATION ====================
const API_URL = "https://uat-api.mmovie.site/";
let allPosts = [];
let allAds = [];
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;
let paragraphValue = '';
let editParagraphValue = '';

// Genres, rating, HOT feature, and content type
let selectedGenres = [];
let editSelectedGenres = [];
let currentRating = 0;
let editCurrentRating = 0;
let currentIsHot = false;
let editCurrentIsHot = false;
let currentContentType = 'censored';
let editCurrentContentType = 'censored';

// Post History variables
let currentPage = 1;
const postsPerPage = 6;
let searchQuery = '';
let activeFilters = {
    hotOnly: false,
    contentType: 'all',
    hasDownload: 'all',
    hasTrailer: 'all',
    hasRating: 'all'
};

// OTP state
let pendingEmail = null;
let resetPendingEmail = null;

// Debug logging
function debugLog(message, data = null) {
    console.log(`[Admin] ${message}`, data || '');
}

// ==================== HELPER: Google Drive URL to Thumbnail ====================
function convertGoogleDriveUrlToThumbnail(url) {
    if (!url) return url;
    if (url.includes('drive.google.com/thumbnail')) return url;
    
    const drivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(drivePattern);
    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
    }
    
    const downloadPattern = /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/;
    const downloadMatch = url.match(downloadPattern);
    if (downloadMatch) {
        const fileId = downloadMatch[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
    }
    
    return url;
}

// ==================== FACEBOOK POST GENERATOR MODAL ====================
let lastPublishedPost = null;

function openFbPostModal(post, postLink) {
    if (!post || !postLink) {
        showAlert("Post data not available", "warning");
        return;
    }
    
    lastPublishedPost = { post, postLink };
    
    let titleHashtag = post.Title.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
    const yearMatch = post.Title.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : '';
    
    let contentText = post.Paragraph || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentText;
    contentText = tempDiv.textContent || tempDiv.innerText || '';
    
    let mainText = '';
    if (year) {
        mainText += `${post.Title.replace(`(${year})`, '').trim()} (${year})`;
    } else {
        mainText += `${post.Title}`;
    }
    mainText += ` ကို M - Movie တွင် ကြည့်လို့ရပြီ\n\n`;
    mainText += `ဇာတ်လမ်းအညွှန်း : \n`;
    mainText += contentText + '\n\n';
    mainText += `Comment တွင် ဇာတ်ကား link ကိုကြည့်ပါ။\n\n`;
    mainText += `Website မှ တစ်ဆင့်ရှာဖွေရန် 👇🏼\n`;
    mainText += `www.mmovie.site\n\n`;
    mainText += `#${titleHashtag}`;
    if (year && !titleHashtag.endsWith(year)) {
        mainText += `_${year}`;
    }
    mainText += `\n`;
    mainText += `#M_Movie\n`;
    mainText += `#MMSUB`;
    
    let commentText = `ဇာတ်ကားကြည့်ရှုရန် 👇🏼\n`;
    commentText += `${postLink}\n\n`;
    commentText += `#${titleHashtag}`;
    if (year && !titleHashtag.endsWith(year)) {
        commentText += `_${year}`;
    }
    commentText += `\n`;
    commentText += `#M_Movie\n`;
    commentText += `#MMSUB`;
    
    document.getElementById('fbPostText').value = mainText;
    document.getElementById('fbPreviewContent').innerHTML = mainText.replace(/\n/g, '<br>');
    document.getElementById('fbCommentText').value = commentText;
    document.getElementById('fbCommentPreview').innerHTML = commentText.replace(/\n/g, '<br>');
    
    const urlDisplay = document.getElementById('fbPreviewLink');
    const titleDisplay = document.getElementById('fbPreviewTitle');
    const descDisplay = document.getElementById('fbPreviewDesc');
    
    if (urlDisplay) urlDisplay.textContent = postLink;
    if (titleDisplay) titleDisplay.textContent = post.Title || 'Untitled Post';
    if (descDisplay) descDisplay.textContent = contentText.substring(0, 100) + '...';
    
    document.getElementById('fbPostUrl').value = postLink;
    
    const fbModal = new bootstrap.Modal(document.getElementById('fbPostModal'));
    fbModal.show();
}

function copyFbPostText() {
    const textarea = document.getElementById('fbPostText');
    if (!textarea) return;
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textarea.value).then(() => {
        showAlert('Facebook main post copied to clipboard!', 'success');
    }).catch(err => {
        showAlert('Failed to copy text', 'danger');
    });
}

function copyFbCommentText() {
    const textarea = document.getElementById('fbCommentText');
    if (!textarea) return;
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textarea.value).then(() => {
        showAlert('Facebook comment copied to clipboard!', 'success');
    }).catch(err => {
        showAlert('Failed to copy text', 'danger');
    });
}

function refreshFbPost() {
    if (!lastPublishedPost) {
        showAlert('No post data available', 'warning');
        return;
    }
    
    const { post, postLink } = lastPublishedPost;
    const includeWebsite = document.getElementById('includeWebsiteLink')?.checked ?? true;
    const includeHashtags = document.getElementById('includeHashtags')?.checked ?? true;
    const includeTrailerNote = document.getElementById('includeTrailerNote')?.checked ?? true;
    const includeEmojis = document.getElementById('includeEmojis')?.checked ?? true;
    const additionalTags = document.getElementById('additionalHashtags')?.value.trim() || '';
    const customUrl = document.getElementById('fbPostUrl')?.value.trim() || postLink;
    
    let titleHashtag = post.Title.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
    const yearMatch = post.Title.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : '';
    
    let contentText = post.Paragraph || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentText;
    contentText = tempDiv.textContent || tempDiv.innerText || '';
    
    let mainText = '';
    if (year) {
        mainText += `${post.Title.replace(`(${year})`, '').trim()} (${year})`;
    } else {
        mainText += `${post.Title}`;
    }
    mainText += ` ကို M - Movie တွင် ကြည့်လို့ရပြီ\n\n`;
    mainText += `ဇာတ်လမ်းအညွှန်း : \n`;
    mainText += contentText + '\n\n';
    
    if (includeTrailerNote && post.TrailerLink && post.TrailerLink.trim() !== '') {
        mainText += `Trailer ကြည့်ရန် 👇🏼\n${post.TrailerLink}\n\n`;
    }
    
    mainText += `Comment တွင် ဇာတ်ကား link ကိုကြည့်ပါ။\n\n`;
    
    if (includeWebsite) {
        mainText += `Website မှ တစ်ဆင့်ရှာဖွေရန် ${includeEmojis ? '👇🏼' : ':'}\n`;
        mainText += `www.mmovie.site\n\n`;
    }
    
    if (includeHashtags) {
        mainText += `#${titleHashtag}`;
        if (year && !titleHashtag.endsWith(year)) {
            mainText += `_${year}`;
        }
        mainText += `\n`;
        mainText += `#M_Movie\n`;
        mainText += `#MMSUB\n`;
        
        if (additionalTags) {
            const tags = additionalTags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => {
                if (!tag.startsWith('#')) tag = '#' + tag;
                mainText += `${tag}\n`;
            });
        }
    }
    
    let commentText = `ဇာတ်ကားကြည့်ရှုရန် ${includeEmojis ? '👇🏼' : ':'}\n`;
    commentText += `${customUrl}\n\n`;
    
    if (includeHashtags) {
        commentText += `#${titleHashtag}`;
        if (year && !titleHashtag.endsWith(year)) {
            commentText += `_${year}`;
        }
        commentText += `\n`;
        commentText += `#M_Movie\n`;
        commentText += `#MMSUB\n`;
        
        if (additionalTags) {
            const tags = additionalTags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => {
                if (!tag.startsWith('#')) tag = '#' + tag;
                commentText += `${tag}\n`;
            });
        }
    }
    
    document.getElementById('fbPostText').value = mainText;
    document.getElementById('fbPreviewContent').innerHTML = mainText.replace(/\n/g, '<br>');
    document.getElementById('fbCommentText').value = commentText;
    document.getElementById('fbCommentPreview').innerHTML = commentText.replace(/\n/g, '<br>');
    
    showAlert('Facebook post regenerated!', 'success');
}

function generateRandomUrl() {
    if (!lastPublishedPost) {
        showAlert('No post data available', 'warning');
        return;
    }
    const randomId = generateUUID();
    const url = `https://mmovie.site/?post=${randomId}`;
    document.getElementById('fbPostUrl').value = url;
    refreshFbPost();
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateFbPostFromHistory(postId) {
    const post = allPosts.find(p => p.ID == postId);
    if (!post) {
        showAlert("Post not found", "danger");
        return;
    }
    const postLink = `https://mmovie.site/?post=${post.ID}`;
    openFbPostModal(post, postLink);
    showAlert("Facebook post generated successfully!", "success");
}

// ==================== GOOGLE DRIVE URL CONVERTER (for posts) ====================
function convertGoogleDriveUrl(url) {
    if (!url) return url;
    if (url.includes('drive.google.com/thumbnail')) return url;
    const drivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(drivePattern);
    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
    }
    return url;
}

function convertEditGoogleDriveUrl(url) {
    if (!url) return url;
    if (url.includes('drive.google.com/thumbnail')) return url;
    const drivePattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(drivePattern);
    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=s800`;
    }
    return url;
}

// ==================== CONTENT TYPE FUNCTIONS ====================
function initContentType() {
    // Set default to 'censored' to match HTML
    currentContentType = 'censored';
    editCurrentContentType = 'censored';
    
    const contentTypeRadios = document.querySelectorAll('input[name="contentType"]');
    contentTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            currentContentType = this.value;
            debugLog('Content type changed to:', currentContentType);
        });
    });
    
    const editContentTypeRadios = document.querySelectorAll('input[name="editContentType"]');
    editContentTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            editCurrentContentType = this.value;
            debugLog('Edit content type changed to:', editCurrentContentType);
        });
    });
    
    // Set default checked values to match HTML (censored and uncensored both checked by default in HTML)
    const censoredRadio = document.querySelector('input[name="contentType"][value="censored"]');
    const uncensoredRadio = document.querySelector('input[name="contentType"][value="uncensored"]');
    if (censoredRadio) censoredRadio.checked = true;
    // Note: In HTML, both censored and uncensored have 'checked' attribute, but only one can be selected
    // We'll keep censored as default
    
    // For edit modal, default to movie (first radio)
    const editMovieRadio = document.querySelector('input[name="editContentType"][value="movie"]');
    if (editMovieRadio) editMovieRadio.checked = true;
}

function getContentTypeBadge(contentType) {
    switch(contentType) {
        case 'censored': return `<span class="badge badge-movie"><i class="fas fa-eye-slash me-1"></i>Censored</span>`;
        case 'uncensored': return `<span class="badge badge-series"><i class="fas fa-eye me-1"></i>Uncensored</span>`;
        case 'Straight': return `<span class="badge badge-animation"><i class="fas fa-venus-mars me-1"></i>Straight</span>`;
        case 'LGBT': return `<span class="badge badge-lgbt"><i class="fas fa-rainbow me-1"></i>LGBT</span>`;
        default: return `<span class="badge badge-movie"><i class="fas fa-film me-1"></i>${contentType}</span>`;
    }
}

// ==================== ADS MANAGEMENT FUNCTIONS ====================

async function loadAds() {
    const container = document.getElementById('adsListContainer');
    if (!container) return;
    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p class="mt-2 text-muted">Loading ads...</p></div>`;
    
    try {
        const response = await fetch(`${API_URL}?action=getAds&from=mmovie.site`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allAds = data;
            renderAdsList();
        } else {
            container.innerHTML = `<div class="alert alert-info">No ads found. Click "Add New Ad" to get started.</div>`;
        }
    } catch (error) {
        console.error('Error loading ads:', error);
        container.innerHTML = `<div class="alert alert-danger">Failed to load ads: ${error.message}<br><button class="btn btn-sm btn-outline-danger mt-2" onclick="loadAds()">Retry</button></div>`;
    }
}

function renderAdsList() {
    const container = document.getElementById('adsListContainer');
    if (!container) return;
    
    if (allAds.length === 0) {
        container.innerHTML = `<div class="alert alert-info">No ads found. Click "Add New Ad" to get started.</div>`;
        return;
    }
    
    let html = `<div class="table-responsive">
        <table class="table table-hover">
            <thead class="table-light">
                <tr><th>Title</th><th>Type</th><th>Placement</th><th>Frequency</th><th>Duration</th><th>PageLoad</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>`;
    
    allAds.forEach(ad => {
        const now = new Date().toISOString();
        let status = '<span class="badge bg-success">Active</span>';
        if (ad.EndDate && ad.EndDate < now) {
            status = '<span class="badge bg-secondary">Expired</span>';
        } else if (ad.StartDate && ad.StartDate > now) {
            status = '<span class="badge bg-warning">Scheduled</span>';
        }
        
        html += `<tr>
            <td><strong>${escapeHtml(ad.Title)}</strong></td>
            <td><span class="badge bg-info">${ad.Type}</span></td>
            <td>${ad.Placement === 'both' ? '🌐 Web + 📱 App' : ad.Placement === 'web' ? '🌐 Website' : '📱 App'}</td>
            <td>${ad.Frequency}/day</td>
            <td>${ad.Duration}s</td>
            <td>${ad.PageLoad ? '<span class="badge bg-success"><i class="fas fa-home"></i> Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td>
            <td>${status}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAd('${ad.ID}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAd('${ad.ID}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    
    html += `</tbody>
        </table>
    </div>`;
    container.innerHTML = html;
}

function showAddAdModal() {
    const adModalTitle = document.getElementById('adModalTitle');
    const adId = document.getElementById('adId');
    const adTitle = document.getElementById('adTitle');
    const adType = document.getElementById('adType');
    const adContent = document.getElementById('adContent');
    const adLink = document.getElementById('adLink');
    const adDuration = document.getElementById('adDuration');
    const adFrequency = document.getElementById('adFrequency');
    const adPlacement = document.getElementById('adPlacement');
    const adStartDate = document.getElementById('adStartDate');
    const adEndDate = document.getElementById('adEndDate');
    
    if (!adModalTitle || !adId || !adTitle) {
        console.error('Modal elements not found. Make sure adModal is properly loaded.');
        showAlert('Error: Modal elements not found. Please refresh the page.', 'danger');
        return;
    }
    
    adModalTitle.textContent = 'Add New Ad';
    adId.value = '';
    adTitle.value = '';
    if (adType) adType.value = 'image';
    if (adContent) adContent.value = '';
    if (adLink) adLink.value = '';
    if (adDuration) adDuration.value = '15';
    if (adFrequency) adFrequency.value = '3';
    if (adPlacement) adPlacement.value = 'both';
    if (adStartDate) adStartDate.value = '';
    if (adEndDate) adEndDate.value = '';
    toggleAdContentType();
    updateAdPreview();
    populatePostDropdown();
    
    const modal = new bootstrap.Modal(document.getElementById('adModal'));
    modal.show();
}

function editAd(adId) {
    const ad = allAds.find(a => a.ID === adId);
    if (!ad) return;
    
    document.getElementById('adModalTitle').textContent = 'Edit Ad';
    document.getElementById('adId').value = ad.ID;
    document.getElementById('adTitle').value = ad.Title || '';
    document.getElementById('adType').value = ad.Type || 'image';
    document.getElementById('adContent').value = ad.Content || '';
    document.getElementById('adLink').value = ad.Link || '';
    document.getElementById('adDuration').value = ad.Duration || 15;
    document.getElementById('adFrequency').value = ad.Frequency || 3;
    document.getElementById('adPlacement').value = ad.Placement || 'both';
    document.getElementById('adStartDate').value = ad.StartDate || '';
    document.getElementById('adEndDate').value = ad.EndDate || '';
    toggleAdContentType();
    updateAdPreview();
    populatePostDropdown(ad.PostId);
    
    const modal = new bootstrap.Modal(document.getElementById('adModal'));
    modal.show();
}

function populatePostDropdown(selectedPostId) {
    const select = document.getElementById('adPostId');
    if (!select) return;
    select.innerHTML = '<option value="all">All Posts</option>';
    
    if (allPosts && allPosts.length > 0) {
        allPosts.forEach(post => {
            const option = document.createElement('option');
            option.value = post.ID;
            option.textContent = post.Title.length > 50 ? post.Title.substring(0, 50) + '...' : post.Title;
            if (selectedPostId === post.ID) option.selected = true;
            select.appendChild(option);
        });
    }
}

function toggleAdContentType() {
    const type = document.getElementById('adType')?.value;
    const container = document.getElementById('adContentInputs');
    const input = document.getElementById('adContent');
    
    if (!container) return;
    
    if (type === 'html') {
        container.innerHTML = `<textarea id="adContent" class="form-control" rows="4" placeholder="<div>Your HTML code here</div>"></textarea>`;
    } else {
        container.innerHTML = `<input type="text" id="adContent" class="form-control" placeholder="${type === 'video' ? 'YouTube or MP4 URL' : 'Image/GIF URL'}">`;
    }
    
    const newInput = document.getElementById('adContent');
    if (newInput) {
        newInput.value = input ? input.value : '';
        newInput.addEventListener('input', () => updateAdPreview());
        newInput.addEventListener('change', () => updateAdPreview());
    }
    
    updateAdPreview();
}

function updateAdPreview() {
    const type = document.getElementById('adType')?.value;
    let content = document.getElementById('adContent')?.value || '';
    const link = document.getElementById('adLink')?.value || '#';
    const previewDiv = document.getElementById('adPreview');
    
    if (!previewDiv) return;
    
    if (!content) {
        previewDiv.innerHTML = '<span class="text-muted">Enter content to see preview</span>';
        return;
    }
    
    const convertedContent = convertGoogleDriveUrlToThumbnail(content);
    
    let previewHtml = `<a href="${link}" target="_blank" class="text-decoration-none">`;
    
    if (type === 'image' || type === 'gif') {
        previewHtml += `<img src="${convertedContent}" style="max-width: 100%; max-height: 200px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/300x150?text=Invalid+Image'">`;
        if (content !== convertedContent) {
            previewHtml += `<div class="small text-success mt-1"><i class="fas fa-check-circle"></i> Google Drive link converted to thumbnail</div>`;
        }
    } else if (type === 'video') {
        let videoUrl = content;
        if (content.includes('youtube.com/watch') || content.includes('youtu.be')) {
            const videoId = extractYouTubeVideoIdForAd(content);
            if (videoId) {
                previewHtml += `<iframe width="100%" height="200" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
            } else {
                previewHtml += `<video controls style="max-width: 100%; max-height: 200px;"><source src="${content}" type="video/mp4">Your browser does not support video.</video>`;
            }
        } else {
            previewHtml += `<video controls style="max-width: 100%; max-height: 200px;"><source src="${content}" type="video/mp4">Your browser does not support video.</video>`;
        }
    } else if (type === 'html') {
        previewHtml += `<div class="small p-2 border rounded bg-white" style="max-height: 200px; overflow: auto;">${content}</div>`;
    }
    
    previewHtml += `</a>`;
    previewDiv.innerHTML = previewHtml;
}

function extractYouTubeVideoIdForAd(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

async function saveAd() {
    const id = document.getElementById('adId')?.value;
    const title = document.getElementById('adTitle')?.value.trim();
    const type = document.getElementById('adType')?.value;
    let content = document.getElementById('adContent')?.value.trim() || '';
    const link = document.getElementById('adLink')?.value.trim();
    const duration = parseInt(document.getElementById('adDuration')?.value) || 15;
    const frequency = parseInt(document.getElementById('adFrequency')?.value) || 3;
    const placement = document.getElementById('adPlacement')?.value;
    const postId = document.getElementById('adPostId')?.value;
    const startDate = document.getElementById('adStartDate')?.value || '';
    const endDate = document.getElementById('adEndDate')?.value || '';
    
    if (!title || !content) {
        showAlert("Please fill in Title and Content", "warning");
        return;
    }
    
    content = convertGoogleDriveUrlToThumbnail(content);
    
    const action = id ? 'updateAd' : 'addAd';
    const params = new URLSearchParams();
    params.append('action', action);
    params.append('from', 'mmovie.site');
    if (id) params.append('id', id);
    params.append('adTitle', title);
    params.append('adType', type);
    params.append('adContent', content);
    params.append('adLink', link || '');
    params.append('adDuration', duration);
    params.append('adFrequency', frequency);
    params.append('adPlacement', placement);
    params.append('adPostId', postId || 'all');
    params.append('adStartDate', startDate);
    params.append('adEndDate', endDate);
    
    const saveBtn = document.querySelector('#adModal .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert(id ? "Ad updated successfully!" : "Ad added successfully!", "success");
            bootstrap.Modal.getInstance(document.getElementById('adModal')).hide();
            await loadAds();
        } else {
            showAlert(result.message || "Error saving ad", "danger");
        }
    } catch (error) {
        console.error('Save ad error:', error);
        showAlert("Error: " + error.message, "danger");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteAd(adId) {
    if (!confirm("Are you sure you want to delete this ad? This action cannot be undone.")) return;
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'deleteAd');
        params.append('id', adId);
        params.append('from', 'mmovie.site');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert("Ad deleted successfully!", "success");
            await loadAds();
        } else {
            showAlert(result.message || "Error deleting ad", "danger");
        }
    } catch (error) {
        console.error('Delete ad error:', error);
        showAlert("Error: " + error.message, "danger");
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== HOT FEATURE FUNCTIONS ====================
function initHotFeature() {
    const isHotCheckbox = document.getElementById('isHot');
    const editIsHotCheckbox = document.getElementById('editIsHot');
    if (isHotCheckbox) {
        isHotCheckbox.addEventListener('change', function() {
            currentIsHot = this.checked;
            updateHotIndicator();
        });
    }
    if (editIsHotCheckbox) {
        editIsHotCheckbox.addEventListener('change', function() {
            editCurrentIsHot = this.checked;
            updateEditHotIndicator();
        });
    }
    updateHotIndicator();
    updateEditHotIndicator();
}

function updateHotIndicator() {
    const indicator = document.getElementById('hotIndicator');
    if (indicator) indicator.style.display = currentIsHot ? 'block' : 'none';
}

function updateEditHotIndicator() {
    const indicator = document.getElementById('editHotIndicator');
    if (indicator) indicator.style.display = editCurrentIsHot ? 'block' : 'none';
}

// ==================== RICH TEXT EDITOR FUNCTIONS ====================
function formatText(command, value = null) {
    const paragraph = document.getElementById('paragraph');
    if (paragraph) {
        paragraph.focus();
        document.execCommand(command, false, value);
        updateParagraphValue();
    }
}

function formatEditText(command, value = null) {
    const editParagraph = document.getElementById('editParagraph');
    if (editParagraph) {
        editParagraph.focus();
        document.execCommand(command, false, value);
        updateEditParagraphValue();
    }
}

function clearFormatting() {
    const paragraph = document.getElementById('paragraph');
    if (paragraph) {
        paragraph.focus();
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        updateParagraphValue();
    }
}

function clearEditFormatting() {
    const editParagraph = document.getElementById('editParagraph');
    if (editParagraph) {
        editParagraph.focus();
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        updateEditParagraphValue();
    }
}

function updateParagraphValue() {
    const paragraph = document.getElementById('paragraph');
    if (paragraph) {
        paragraphValue = paragraph.innerHTML;
    }
}

function updateEditParagraphValue() {
    const editParagraph = document.getElementById('editParagraph');
    if (editParagraph) {
        editParagraphValue = editParagraph.innerHTML;
    }
}

// ==================== PASSWORD TOGGLE ====================
function togglePassword() {
    const passwordField = document.getElementById("password");
    const toggleIcon = document.querySelector(".password-toggle i");
    if (passwordField && toggleIcon) {
        if (passwordField.type === "password") {
            passwordField.type = "text";
            toggleIcon.classList.remove("fa-eye");
            toggleIcon.classList.add("fa-eye-slash");
        } else {
            passwordField.type = "password";
            toggleIcon.classList.remove("fa-eye-slash");
            toggleIcon.classList.add("fa-eye");
        }
    }
}

// ==================== GENRES FUNCTIONS ====================
function initGenres() {
    selectedGenres = [];
    editSelectedGenres = [];
    updateGenresDisplay();
    updateEditGenresDisplay();
}

function addGenreFromInput() {
    const input = document.getElementById('genreInput');
    if (!input) return;
    const genre = input.value.trim();
    if (genre && !selectedGenres.includes(genre)) {
        selectedGenres.push(genre);
        updateGenresDisplay();
    }
    input.value = '';
    input.focus();
}

function addQuickGenre(genre) {
    if (!selectedGenres.includes(genre)) {
        selectedGenres.push(genre);
        updateGenresDisplay();
    }
}

function updateGenresDisplay() {
    const container = document.getElementById('selectedGenres');
    if (!container) return;
    container.innerHTML = '';
    if (selectedGenres.length === 0) {
        container.innerHTML = '<span class="text-muted small">No genres selected</span>';
        return;
    }
    selectedGenres.forEach((genre, index) => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.innerHTML = `${genre}<button type="button" class="genre-remove" onclick="removeGenre(${index})"><i class="fas fa-times"></i></button>`;
        container.appendChild(tag);
    });
}

function removeGenre(index) {
    selectedGenres.splice(index, 1);
    updateGenresDisplay();
}

function addEditGenreFromInput() {
    const input = document.getElementById('editGenreInput');
    if (!input) return;
    const genre = input.value.trim();
    if (genre && !editSelectedGenres.includes(genre)) {
        editSelectedGenres.push(genre);
        updateEditGenresDisplay();
    }
    input.value = '';
    input.focus();
}

function addEditQuickGenre(genre) {
    if (!editSelectedGenres.includes(genre)) {
        editSelectedGenres.push(genre);
        updateEditGenresDisplay();
    }
}

function updateEditGenresDisplay() {
    const container = document.getElementById('editSelectedGenres');
    if (!container) return;
    container.innerHTML = '';
    if (editSelectedGenres.length === 0) {
        container.innerHTML = '<span class="text-muted small">No genres selected</span>';
        return;
    }
    editSelectedGenres.forEach((genre, index) => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.innerHTML = `${genre}<button type="button" class="genre-remove" onclick="removeEditGenre(${index})"><i class="fas fa-times"></i></button>`;
        container.appendChild(tag);
    });
}

function removeEditGenre(index) {
    editSelectedGenres.splice(index, 1);
    updateEditGenresDisplay();
}

// ==================== RATING FUNCTIONS ====================
function initRating() {
    currentRating = 0;
    editCurrentRating = 0;
    setupRatingStars();
    setupEditRatingStars();
}

function setupRatingStars() {
    const stars = document.querySelectorAll('#ratingStars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            currentRating = parseInt(star.getAttribute('data-value'));
            updateRatingDisplay();
        });
        star.addEventListener('mouseover', () => {
            highlightStars(parseInt(star.getAttribute('data-value')), 'ratingStars');
        });
    });
    const ratingStars = document.getElementById('ratingStars');
    if (ratingStars) {
        ratingStars.addEventListener('mouseleave', () => {
            highlightStars(currentRating, 'ratingStars');
        });
    }
}

function setupEditRatingStars() {
    const stars = document.querySelectorAll('#editRatingStars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            editCurrentRating = parseInt(star.getAttribute('data-value'));
            updateEditRatingDisplay();
        });
        star.addEventListener('mouseover', () => {
            highlightStars(parseInt(star.getAttribute('data-value')), 'editRatingStars');
        });
    });
    const editRatingStars = document.getElementById('editRatingStars');
    if (editRatingStars) {
        editRatingStars.addEventListener('mouseleave', () => {
            highlightStars(editCurrentRating, 'editRatingStars');
        });
    }
}

function highlightStars(rating, containerId) {
    const stars = document.querySelectorAll(`#${containerId} .star i`);
    stars.forEach((star, index) => {
        const starValue = index + 1;
        if (starValue <= rating) {
            star.className = 'fas fa-star';
            star.style.color = '#ffc107';
        } else {
            star.className = 'far fa-star';
            star.style.color = '#ccc';
        }
    });
}

function updateRatingDisplay() {
    const input = document.getElementById('ratingValue');
    const text = document.getElementById('ratingText');
    if (input) input.value = currentRating;
    highlightStars(currentRating, 'ratingStars');
    if (text) {
        if (currentRating > 0) {
            text.innerHTML = `<span class="text-warning"><i class="fas fa-star"></i> ${currentRating}/10</span>`;
        } else {
            text.textContent = 'No rating selected';
        }
    }
}

function updateEditRatingDisplay() {
    const input = document.getElementById('editRatingValue');
    const text = document.getElementById('editRatingText');
    if (input) input.value = editCurrentRating;
    highlightStars(editCurrentRating, 'editRatingStars');
    if (text) {
        if (editCurrentRating > 0) {
            text.innerHTML = `<span class="text-warning"><i class="fas fa-star"></i> ${editCurrentRating}/10</span>`;
        } else {
            text.textContent = 'No rating selected';
        }
    }
}

function updateStarsFromInput() {
    const input = document.getElementById('ratingValue');
    if (!input) return;
    let value = parseFloat(input.value);
    if (isNaN(value) || value < 0) value = 0;
    if (value > 10) value = 10;
    currentRating = value;
    updateRatingDisplay();
}

function updateEditStarsFromInput() {
    const input = document.getElementById('editRatingValue');
    if (!input) return;
    let value = parseFloat(input.value);
    if (isNaN(value) || value < 0) value = 0;
    if (value > 10) value = 10;
    editCurrentRating = value;
    updateEditRatingDisplay();
}

function clearRating() {
    currentRating = 0;
    updateRatingDisplay();
}

function clearEditRating() {
    editCurrentRating = 0;
    updateEditRatingDisplay();
}

// ==================== LOGIN & OTP FUNCTIONS ====================
async function login() {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();
    debugLog('Login attempt:', { email, pass });
    if (!email || !pass) {
        showAlert("Please enter both email and password", "warning");
        return;
    }
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        showAlert("Too many failed attempts. Please try again later.", "danger");
        return;
    }
    try {
        const loginResult = await loginWithJSONP(email, pass);
        debugLog('Login result:', loginResult);
        
        if (loginResult && loginResult.success) {
            if (loginResult.requireOTP) {
                pendingEmail = loginResult.email;
                showOTPModal(pendingEmail);
                requestOTP();
            } else {
                loginAttempts = 0;
                document.getElementById("loginBox").style.display = "none";
                document.getElementById("uploadBox").style.display = "block";
                await loadPostsWithFetch();
                await loadStats();
                showAlert("Login successful! Welcome back.", "success");
                localStorage.setItem('adminLoggedIn', 'true');
                localStorage.setItem('loginTime', Date.now());
                localStorage.setItem('username', email);
            }
        } else {
            loginAttempts++;
            const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts;
            showAlert(`Invalid email or password. ${remaining} attempt(s) remaining.`, "danger");
            document.getElementById("password").value = "";
        }
    } catch (error) {
        console.error("Login error:", error);
        loginAttempts++;
        const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts;
        showAlert(`Login failed: ${error.message}. ${remaining} attempt(s) remaining.`, "danger");
        document.getElementById("password").value = "";
    }
}

function loginWithJSONP(email, pass) {
    return new Promise((resolve, reject) => {
        const callbackName = 'loginCallback_' + Date.now();
        window[callbackName] = function(data) {
            delete window[callbackName];
            if (script.parentElement) document.body.removeChild(script);
            debugLog('JSONP login response received:', data);
            resolve(data);
        };
        
        const script = document.createElement('script');
        script.src = `${API_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&from=mmovie.site&callback=${callbackName}`;
        script.onerror = (err) => {
            console.error('Script load error:', err);
            if (script.parentElement) document.body.removeChild(script);
            if (window[callbackName]) delete window[callbackName];
            reject(new Error('JSONP request failed - network error'));
        };
        
        const timeoutId = setTimeout(() => {
            if (script.parentElement) document.body.removeChild(script);
            if (window[callbackName]) delete window[callbackName];
            reject(new Error('JSONP timeout - server not responding'));
        }, 15000);
        
        const originalCallback = window[callbackName];
        window[callbackName] = function(data) {
            clearTimeout(timeoutId);
            originalCallback(data);
        };
        
        document.body.appendChild(script);
    });
}

async function loadPostsWithFetch() {
    try {
        const response = await fetch(`${API_URL}?action=getPosts&from=mmovie.site`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allPosts = data;
            if (document.getElementById('adPostId')) {
                populatePostDropdown();
            }
            renderPostHistory();
            return true;
        } else if (!data || (Array.isArray(data) && data.length === 0)) {
            const historyContainer = document.getElementById("postHistory");
            if (historyContainer) {
                historyContainer.innerHTML = `<div class="text-center py-5"><i class="fas fa-inbox fa-4x text-muted mb-3"></i><h5 class="text-muted">No posts yet</h5><p class="text-muted">Create your first post to get started</p><button class="btn btn-primary mt-3" onclick="document.getElementById('title').focus()"><i class="fas fa-plus me-1"></i>Create First Post</button></div>`;
            }
            allPosts = [];
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading posts with fetch:', error);
        const historyContainer = document.getElementById("postHistory");
        if (historyContainer) {
            historyContainer.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load posts: ${error.message}<br><button class="btn btn-sm btn-outline-danger mt-2" onclick="loadPostsWithFetch()">Retry</button></div>`;
        }
        return false;
    }
}

function loadPostsWithJSONP() {
    return loadPostsWithFetch();
}

async function loadPostHistory() {
    const historyContainer = document.getElementById("postHistory");
    if (historyContainer) {
        historyContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p class="mt-2 text-muted">Loading posts...</p></div>`;
    }
    debugLog('Loading post history...');
    try {
        await loadPostsWithFetch();
    } catch (error) {
        console.error("Error loading post history:", error);
    }
}

function showOTPModal(email) {
    const otpEmailDisplay = document.getElementById('otpEmailDisplay');
    const otpModal = document.getElementById('otpModal');
    const otpCode = document.getElementById('otpCode');
    if (otpEmailDisplay) otpEmailDisplay.textContent = email;
    if (otpModal) otpModal.style.display = 'block';
    if (otpCode) otpCode.focus();
}

function hideOTPModal() {
    const otpModal = document.getElementById('otpModal');
    if (otpModal) otpModal.style.display = 'none';
    pendingEmail = null;
}

function cancelOTP() {
    hideOTPModal();
    const passwordField = document.getElementById("password");
    if (passwordField) passwordField.value = "";
}

function requestOTP() {
    if (!pendingEmail) {
        showAlert("No email available. Please login again.", "warning");
        return;
    }
    const callbackName = 'requestOTPCallback_' + Date.now();
    window[callbackName] = function(data) {
        delete window[callbackName];
        if (script.parentElement) document.body.removeChild(script);
        if (data && data.success) {
            showAlert("OTP sent to your email.", "success");
        } else {
            showAlert("Failed to send OTP: " + (data.message || "Unknown error"), "danger");
        }
    };
    const script = document.createElement('script');
    script.src = `${API_URL}?action=sendOTP&email=${encodeURIComponent(pendingEmail)}&from=mmovie.site&callback=${callbackName}`;
    script.onerror = () => {
        if (script.parentElement) document.body.removeChild(script);
        if (window[callbackName]) delete window[callbackName];
        showAlert("Network error while requesting OTP.", "danger");
    };
    document.body.appendChild(script);
}

function verifyOTP() {
    const otp = document.getElementById('otpCode').value.trim();
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
        showAlert("Please enter a valid 6-digit OTP.", "warning");
        return;
    }
    
    const email = window.otpPurpose === 'reset' ? resetPendingEmail : pendingEmail;
    if (!email) {
        showAlert("Session expired. Please try again.", "warning");
        return;
    }
    
    const callbackName = 'verifyOTPCallback_' + Date.now();
    window[callbackName] = function(data) {
        delete window[callbackName];
        if (script.parentElement) document.body.removeChild(script);
        
        if (data && data.success) {
            if (window.otpPurpose === 'reset') {
                const otpModal = document.getElementById('otpModal');
                const resetPasswordForm = document.getElementById('resetPasswordForm');
                const newPassword = document.getElementById('newPassword');
                if (otpModal) otpModal.style.display = 'none';
                if (resetPasswordForm) resetPasswordForm.style.display = 'block';
                if (newPassword) newPassword.focus();
            } else {
                loginAttempts = 0;
                document.getElementById("loginBox").style.display = "none";
                document.getElementById("uploadBox").style.display = "block";
                
                loadPostsWithFetch()
                    .then(() => {
                        loadStats();
                        showAlert("Login successful! Welcome back.", "success");
                        localStorage.setItem('adminLoggedIn', 'true');
                        localStorage.setItem('loginTime', Date.now());
                        localStorage.setItem('username', document.getElementById("email").value.trim());
                    })
                    .catch(e => {
                        console.error('Posts load failed:', e);
                        showAlert("Logged in but failed to load posts. Please refresh the page.", "warning");
                    });
                hideOTPModal();
            }
        } else {
            showAlert("Invalid OTP. Please try again.", "danger");
            const otpCode = document.getElementById('otpCode');
            if (otpCode) {
                otpCode.value = '';
                otpCode.focus();
            }
        }
    };
    
    const script = document.createElement('script');
    script.src = `${API_URL}?action=verifyOTP&email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}&from=mmovie.site&callback=${callbackName}`;
    script.onerror = () => {
        if (script.parentElement) document.body.removeChild(script);
        if (window[callbackName]) delete window[callbackName];
        showAlert("Network error while verifying OTP.", "danger");
    };
    document.body.appendChild(script);
}

// ==================== FORGOT PASSWORD FUNCTIONS ====================
function showForgotPasswordModal() {
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    if (forgotPasswordModal) forgotPasswordModal.style.display = 'block';
}

function cancelForgotPassword() {
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const resetEmail = document.getElementById('resetEmail');
    if (forgotPasswordModal) forgotPasswordModal.style.display = 'none';
    if (resetEmail) resetEmail.value = '';
}

function sendResetOTP() {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) {
        showAlert("Please enter your email", "warning");
        return;
    }
    resetPendingEmail = email;
    const callbackName = 'sendResetOTPCallback_' + Date.now();
    window[callbackName] = function(data) {
        delete window[callbackName];
        if (script.parentElement) document.body.removeChild(script);
        if (data && data.success) {
            showAlert("OTP sent to your email.", "success");
            const forgotPasswordModal = document.getElementById('forgotPasswordModal');
            const otpEmailDisplay = document.getElementById('otpEmailDisplay');
            const otpModal = document.getElementById('otpModal');
            const otpCode = document.getElementById('otpCode');
            if (forgotPasswordModal) forgotPasswordModal.style.display = 'none';
            if (otpEmailDisplay) otpEmailDisplay.textContent = email;
            if (otpModal) otpModal.style.display = 'block';
            if (otpCode) otpCode.focus();
            window.otpPurpose = 'reset';
        } else {
            showAlert("Failed to send OTP: " + (data.message || "Unknown error"), "danger");
        }
    };
    const script = document.createElement('script');
    script.src = `${API_URL}?action=forgotPassword&email=${encodeURIComponent(email)}&from=mmovie.site&callback=${callbackName}`;
    script.onerror = () => {
        if (script.parentElement) document.body.removeChild(script);
        if (window[callbackName]) delete window[callbackName];
        showAlert("Network error while requesting OTP.", "danger");
    };
    document.body.appendChild(script);
}

function resetPassword() {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    if (!newPass || !confirmPass) {
        showAlert("Please enter and confirm new password", "warning");
        return;
    }
    if (newPass !== confirmPass) {
        showAlert("Passwords do not match", "warning");
        return;
    }
    const email = resetPendingEmail;
    const otp = document.getElementById('otpCode').value;
    if (!email || !otp) {
        showAlert("Missing information. Please start over.", "danger");
        return;
    }
    const callbackName = 'resetPasswordCallback_' + Date.now();
    window[callbackName] = function(data) {
        delete window[callbackName];
        if (script.parentElement) document.body.removeChild(script);
        if (data && data.success) {
            showAlert("Password reset successfully! Please login with new password.", "success");
            const resetPasswordForm = document.getElementById('resetPasswordForm');
            const otpCode = document.getElementById('otpCode');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            if (resetPasswordForm) resetPasswordForm.style.display = 'none';
            if (otpCode) otpCode.value = '';
            if (newPassword) newPassword.value = '';
            if (confirmPassword) confirmPassword.value = '';
            resetPendingEmail = null;
            window.otpPurpose = null;
            const loginBox = document.getElementById('loginBox');
            if (loginBox) loginBox.style.display = 'block';
        } else {
            showAlert("Failed to reset password: " + (data.message || "Unknown error"), "danger");
        }
    };
    const script = document.createElement('script');
    script.src = `${API_URL}?action=resetPassword&email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}&newPassword=${encodeURIComponent(newPass)}&from=mmovie.site&callback=${callbackName}`;
    script.onerror = () => {
        if (script.parentElement) document.body.removeChild(script);
        if (window[callbackName]) delete window[callbackName];
        showAlert("Network error while resetting password.", "danger");
    };
    document.body.appendChild(script);
}

function cancelResetPassword() {
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const otpCode = document.getElementById('otpCode');
    if (resetPasswordForm) resetPasswordForm.style.display = 'none';
    if (newPassword) newPassword.value = '';
    if (confirmPassword) confirmPassword.value = '';
    if (otpCode) otpCode.value = '';
    resetPendingEmail = null;
    window.otpPurpose = null;
    const loginBox = document.getElementById('loginBox');
    if (loginBox) loginBox.style.display = 'block';
}

// ==================== CHECK EXISTING LOGIN ====================
function checkExistingLogin() {
    const loggedIn = localStorage.getItem('adminLoggedIn');
    const loginTime = localStorage.getItem('loginTime');
    const username = localStorage.getItem('username');
    if (loggedIn === 'true' && loginTime && username) {
        const hoursSinceLogin = (Date.now() - parseInt(loginTime)) / (1000 * 60 * 60);
        if (hoursSinceLogin < 8) {
            debugLog('Auto-login detected for user:', username);
            document.getElementById("loginBox").style.display = "none";
            document.getElementById("uploadBox").style.display = "block";
            loadPostsWithFetch().then(() => {
                loadStats();
                showAlert(`Welcome back, ${username}!`, "info");
            }).catch(e => {
                console.error('Auto-login posts load failed:', e);
                showAlert(`Welcome back, ${username}! Some features may not work properly.`, "warning");
            });
            return true;
        } else {
            localStorage.clear();
        }
    }
    return false;
}

function logout() {
    if(confirm("Are you sure you want to logout?")) {
        document.getElementById("uploadBox").style.display = "none";
        document.getElementById("loginBox").style.display = "block";
        document.getElementById("email").value = "";
        document.getElementById("password").value = "";
        const paragraph = document.getElementById('paragraph');
        if (paragraph) paragraph.innerHTML = '';
        paragraphValue = '';
        selectedGenres = [];
        currentRating = 0;
        currentIsHot = false;
        currentContentType = 'censored';
        updateGenresDisplay();
        updateRatingDisplay();
        updateHotIndicator();
        const contentTypeCensored = document.querySelector('input[name="contentType"][value="censored"]');
        if (contentTypeCensored) contentTypeCensored.checked = true;
        localStorage.clear();
        showAlert("You have been logged out successfully.", "info");
    }
}

// ==================== UPLOAD POST ====================
async function uploadPost() {
    const title = document.getElementById("title").value.trim();
    const imageURL = document.getElementById("imageURL").value.trim();
    const trailerLink = document.getElementById("trailerLink").value.trim();
    const downloadLink = document.getElementById("downloadLink").value.trim();
    const hasDownload = document.getElementById("hasDownload").checked;
    const genres = selectedGenres.join(', ');
    const rating = currentRating;
    const isHot = currentIsHot;
    const contentType = currentContentType;

    if (!title || !paragraphValue || !imageURL) {
        showAlert("Please fill in all required fields: Title, Content, and Image URL", "warning");
        return;
    }

    let finalImageURL = convertGoogleDriveUrl(imageURL);
    if (imageURL !== finalImageURL) {
        debugLog('Google Drive URL auto-converted:', finalImageURL);
        showAlert("Google Drive URL detected and auto-converted to thumbnail link", "info");
    }

    if (imageURL.startsWith('data:image') && imageURL.length > 50000) {
        const shouldContinue = confirm('The image is very large (base64). This may cause upload issues.\n\nRecommendation: Use an external image URL instead.\n\nDo you want to continue?');
        if (!shouldContinue) return;
    }

    debugLog('Uploading post (title):', title);

    const uploadBtn = document.querySelector('.btn-success');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Publishing...';
    uploadBtn.disabled = true;

    try {
        const params = new URLSearchParams();
        params.append('action', 'addPost');
        params.append('title', title);
        params.append('paragraph', paragraphValue);
        params.append('imageURL', finalImageURL);
        params.append('trailerLink', trailerLink);
        params.append('downloadLink', downloadLink);
        params.append('hasDownload', hasDownload ? 'true' : 'false');
        params.append('genres', genres);
        params.append('rating', rating);
        params.append('isHot', isHot ? 'true' : 'false');
        params.append('contentType', contentType);
        params.append('from', 'mmovie.site');

        console.log('Sending POST to:', API_URL);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const responseText = await response.text();
        console.log('Response received, length:', responseText.length);
        console.log('Response preview:', responseText.substring(0, 200));
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('JSON parse error - raw response:', responseText);
            throw new Error('Server returned invalid response. Please check if GAS is deployed correctly.');
        }
        
        if (result.success) {
            document.getElementById("title").value = "";
            const paragraph = document.getElementById('paragraph');
            if (paragraph) paragraph.innerHTML = "";
            paragraphValue = "";
            document.getElementById("imageURL").value = "";
            document.getElementById("trailerLink").value = "";
            document.getElementById("downloadLink").value = "";
            document.getElementById("hasDownload").checked = false;
            document.getElementById("isHot").checked = false;
            document.getElementById("genreInput").value = "";
            selectedGenres = [];
            currentRating = 0;
            currentIsHot = false;
            currentContentType = 'censored';
            updateGenresDisplay();
            updateRatingDisplay();
            updateHotIndicator();
            const contentTypeCensored = document.querySelector('input[name="contentType"][value="censored"]');
            if (contentTypeCensored) contentTypeCensored.checked = true;

            await loadPostsWithFetch();
            await loadStats();

            showAlert("Post published successfully!", "success");

            const newPost = allPosts.find(p => p.Title === title);
            if (newPost && newPost.ID) {
                const postLink = `https://mmovie.site/?post=${newPost.ID}`;
                setTimeout(() => {
                    openFbPostModal(newPost, postLink);
                }, 500);
            }
        } else {
            showAlert(result.message || "Error publishing post. Please try again.", "danger");
        }

    } catch (error) {
        console.error("Upload error:", error);
        showAlert("Error: " + error.message, "danger");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
}

// ==================== POST HISTORY FUNCTIONS ====================
function renderPostHistory() {
    const historyContainer = document.getElementById("postHistory");
    if (!historyContainer) return;
    
    let postsToDisplay = allPosts;
    if (searchQuery) {
        postsToDisplay = postsToDisplay.filter(post => {
            const titleMatch = post.Title?.toLowerCase().includes(searchQuery.toLowerCase());
            const contentMatch = post.Paragraph?.toLowerCase().includes(searchQuery.toLowerCase());
            const genreMatch = post.Genres?.toLowerCase().includes(searchQuery.toLowerCase());
            return titleMatch || contentMatch || genreMatch;
        });
    }
    if (activeFilters.hotOnly) {
        postsToDisplay = postsToDisplay.filter(post => post.IsHot === "TRUE" || post.IsHot === true);
    }
    if (activeFilters.contentType !== 'all') {
        postsToDisplay = postsToDisplay.filter(post => post.ContentType === activeFilters.contentType);
    }
    if (activeFilters.hasDownload !== 'all') {
        postsToDisplay = postsToDisplay.filter(post => {
            const hasDownload = post.HasDownload === "TRUE" || post.HasDownload === true;
            return activeFilters.hasDownload === 'yes' ? hasDownload : !hasDownload;
        });
    }
    if (activeFilters.hasTrailer !== 'all') {
        postsToDisplay = postsToDisplay.filter(post => {
            const hasTrailer = post.TrailerLink && post.TrailerLink.trim() !== '';
            return activeFilters.hasTrailer === 'yes' ? hasTrailer : !hasTrailer;
        });
    }
    if (activeFilters.hasRating !== 'all') {
        postsToDisplay = postsToDisplay.filter(post => {
            const hasRating = post.Rating && parseFloat(post.Rating) > 0;
            return activeFilters.hasRating === 'yes' ? hasRating : !hasRating;
        });
    }
    const totalPages = Math.ceil(postsToDisplay.length / postsPerPage);
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const paginatedPosts = postsToDisplay.slice(startIndex, endIndex);
    if (!postsToDisplay || postsToDisplay.length === 0) {
        renderEmptyState(historyContainer, postsToDisplay.length === 0 && !searchQuery && !activeFilters.hotOnly && activeFilters.contentType === 'all');
        return;
    }
    paginatedPosts.sort((a, b) => {
        const aIsHot = a.IsHot === "TRUE" || a.IsHot === true;
        const bIsHot = b.IsHot === "TRUE" || b.IsHot === true;
        if (aIsHot && !bIsHot) return -1;
        if (!aIsHot && bIsHot) return 1;
        try {
            return new Date(b.CreatedAt) - new Date(a.CreatedAt);
        } catch (e) {
            return 0;
        }
    });
    historyContainer.innerHTML = createHistoryUI(paginatedPosts, postsToDisplay.length, totalPages);
    updateFilterTags();
}

function createHistoryUI(posts, totalPosts, totalPages) {
    let html = `<div class="history-container"><div class="history-header"><h4 class="mb-0"><i class="fas fa-history me-2"></i>Post History (${totalPosts} posts)</h4></div><div class="history-controls"><div class="row align-items-center"><div class="col-md-6 mb-3 mb-md-0"><div class="history-search-box"><i class="fas fa-search"></i><input type="text" id="searchPosts" class="form-control" placeholder="Search posts by title, content, or genre..." value="${searchQuery}" onkeyup="handleSearch(event)"></div></div><div class="col-md-6"><div class="d-flex flex-wrap gap-2 justify-content-md-end"><button class="btn btn-outline-primary btn-sm" onclick="openAdvancedFilters()"><i class="fas fa-filter me-1"></i>Advanced Filters</button><button class="btn btn-outline-secondary btn-sm" onclick="resetFilters()"><i class="fas fa-redo me-1"></i>Reset All</button><button class="btn btn-outline-success btn-sm" onclick="loadPostHistory()"><i class="fas fa-sync-alt me-1"></i>Refresh</button></div></div></div><div class="filter-tags" id="filterTags"></div></div><div class="posts-grid" id="postsGrid">`;
    posts.forEach((post, index) => { html += createPostCard(post, index); });
    html += `</div>${createPagination(totalPages, totalPosts)}</div>`;
    return html;
}

function createPostCard(post, index) {
    const contentType = post.ContentType || 'movie';
    const hasDownload = post.HasDownload === "TRUE" || post.HasDownload === true;
    const isHotPost = post.IsHot === "TRUE" || post.IsHot === true;
    const hasTrailer = post.TrailerLink && post.TrailerLink.trim() !== '';
    const hasRating = post.Rating && parseFloat(post.Rating) > 0;
    const ratingValue = hasRating ? parseFloat(post.Rating) : 0;
    let genreBadges = '';
    if (post.Genres) {
        const genres = post.Genres.split(',').map(g => g.trim()).filter(g => g).slice(0, 3);
        genres.forEach(genre => { genreBadges += `<span class="badge bg-purple me-1 mb-1"><i class="fas fa-tag me-1"></i>${genre}</span>`; });
        if (post.Genres.split(',').length > 3) { genreBadges += `<span class="badge bg-secondary me-1 mb-1">+${post.Genres.split(',').length - 3}</span>`; }
    }
    let displayDate = post.CreatedAt;
    try {
        const date = new Date(post.CreatedAt);
        if (!isNaN(date.getTime())) {
            displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } catch (e) { console.warn('Date formatting error:', e); }
    let contentPreview = post.Paragraph || '';
    if (contentPreview.length > 150) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentPreview;
        contentPreview = tempDiv.textContent || tempDiv.innerText || '';
        contentPreview = contentPreview.substring(0, 147) + '...';
    }
    return `<div class="post-card-modern ${contentType}"><div class="post-card-header">${post.ImageURL ? `<img src="${post.ImageURL}" alt="${post.Title}" class="post-card-image" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">` : `<div class="post-card-image bg-light d-flex align-items-center justify-content-center"><i class="fas fa-image fa-3x text-muted"></i></div>`}<div class="post-card-overlay"><div class="post-type-badge">${getContentTypeBadge(contentType)}</div>${isHotPost ? `<span class="hot-indicator-badge badge bg-danger"><i class="fas fa-fire me-1"></i>HOT</span>` : ''}</div></div><div class="post-card-body"><h5 class="post-card-title">${post.Title || 'Untitled Post'}</h5><div class="post-card-meta"><span class="post-card-date"><i class="far fa-calendar me-1"></i>${displayDate}</span><span class="post-card-id"><i class="fas fa-hashtag"></i> ${post.ID || index + 1}</span></div><div class="post-card-preview">${contentPreview}</div>${genreBadges ? `<div class="post-card-tags">${genreBadges}</div>` : ''}<div class="post-card-footer"><div class="post-card-stats"><span class="stat-item ${hasDownload ? 'active' : ''}" title="${hasDownload ? 'Download enabled' : 'No download'}"><i class="fas ${hasDownload ? 'fa-download text-success' : 'fa-ban text-muted'}"></i></span><span class="stat-item ${hasTrailer ? 'active' : ''}" title="${hasTrailer ? 'Has trailer' : 'No trailer'}"><i class="fas ${hasTrailer ? 'fa-video text-warning' : 'fa-video-slash text-muted'}"></i></span><span class="stat-item ${hasRating ? 'active' : ''}" title="${hasRating ? `Rating: ${ratingValue}/10` : 'No rating'}"><i class="fas ${hasRating ? 'fa-star text-warning' : 'fa-star text-muted'}"></i>${hasRating ? ratingValue : ''}</span></div><div class="post-card-actions"><button class="btn btn-outline-info btn-sm" onclick="quickViewPost('${post.ID}')" title="Quick View"><i class="fas fa-eye"></i></button><button class="btn btn-primary btn-sm" onclick="generateFbPostFromHistory('${post.ID}')" title="Generate Facebook Post"><i class="fab fa-facebook"></i></button><button class="btn btn-warning btn-sm" onclick="editPost('${post.ID}')" title="Edit"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deletePost('${post.ID}')" title="Delete"><i class="fas fa-trash"></i></button></div></div></div></div>`;
}

function createPagination(totalPages, totalPosts) {
    if (totalPages <= 1) return '';
    const startPost = (currentPage - 1) * postsPerPage + 1;
    const endPost = Math.min(currentPage * postsPerPage, totalPosts);
    let paginationHTML = `<div class="pagination-container"><div class="pagination-info">Showing ${startPost}-${endPost} of ${totalPosts} posts</div><div class="pagination-buttons">`;
    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) { startPage = Math.max(1, endPage - maxVisiblePages + 1); }
    for (let i = startPage; i <= endPage; i++) { paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`; }
    paginationHTML += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    paginationHTML += `</div></div>`;
    return paginationHTML;
}

function renderEmptyState(historyContainer, isFirstTime) {
    if (isFirstTime) {
        historyContainer.innerHTML = `<div class="history-container"><div class="history-header"><h4 class="mb-0"><i class="fas fa-history me-2"></i>Post History</h4></div><div class="empty-state"><div class="empty-state-icon"><i class="fas fa-inbox"></i></div><h5 class="text-muted mb-3">No posts yet</h5><p class="text-muted mb-4">Create your first post to get started</p><button class="btn btn-primary" onclick="document.getElementById('title').focus()"><i class="fas fa-plus me-1"></i>Create First Post</button></div></div>`;
    } else {
        historyContainer.innerHTML = `<div class="history-container"><div class="history-header"><h4 class="mb-0"><i class="fas fa-history me-2"></i>Post History</h4></div><div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h5 class="text-muted mb-3">No posts found</h5><p class="text-muted mb-4">Try adjusting your search or filters</p><button class="btn btn-outline-primary" onclick="resetFilters()"><i class="fas fa-redo me-1"></i>Reset All Filters</button></div></div>`;
    }
}

function handleSearch(event) {
    if (event.key === 'Enter' || event.type === 'change') {
        searchQuery = document.getElementById('searchPosts').value.trim();
        currentPage = 1;
        renderPostHistory();
    }
}

function openAdvancedFilters() {
    const filterModalHTML = `<div class="modal fade" id="advancedFiltersModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"><i class="fas fa-filter me-2"></i>Advanced Filters</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="mb-3"><label class="form-label">Content Type</label><select class="form-select" id="filterContentType"><option value="all">All Types</option><option value="censored">Censored</option><option value="uncensored">Uncensored</option><option value="Straight">Straight</option><option value="LGBT">LGBT</option></select></div><div class="mb-3"><label class="form-label">Download Status</label><select class="form-select" id="filterHasDownload"><option value="all">All</option><option value="yes">With Download</option><option value="no">Without Download</option></select></div><div class="mb-3"><label class="form-label">Trailer Status</label><select class="form-select" id="filterHasTrailer"><option value="all">All</option><option value="yes">With Trailer</option><option value="no">Without Trailer</option></select></div><div class="mb-3"><label class="form-label">Rating Status</label><select class="form-select" id="filterHasRating"><option value="all">All</option><option value="yes">With Rating</option><option value="no">Without Rating</option></select></div><div class="form-check mb-3"><input type="checkbox" class="form-check-input" id="filterHotOnly"><label class="form-check-label">Show HOT posts only</label></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-primary" onclick="applyAdvancedFilters()">Apply Filters</button></div></div></div></div>`;
    const existingModal = document.getElementById('advancedFiltersModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', filterModalHTML);
    const modal = new bootstrap.Modal(document.getElementById('advancedFiltersModal'));
    modal.show();
    document.getElementById('filterContentType').value = activeFilters.contentType;
    document.getElementById('filterHasDownload').value = activeFilters.hasDownload;
    document.getElementById('filterHasTrailer').value = activeFilters.hasTrailer;
    document.getElementById('filterHasRating').value = activeFilters.hasRating;
    document.getElementById('filterHotOnly').checked = activeFilters.hotOnly;
}

function applyAdvancedFilters() {
    activeFilters = {
        contentType: document.getElementById('filterContentType').value,
        hasDownload: document.getElementById('filterHasDownload').value,
        hasTrailer: document.getElementById('filterHasTrailer').value,
        hasRating: document.getElementById('filterHasRating').value,
        hotOnly: document.getElementById('filterHotOnly').checked
    };
    currentPage = 1;
    renderPostHistory();
    const modal = bootstrap.Modal.getInstance(document.getElementById('advancedFiltersModal'));
    modal.hide();
    showAlert('Filters applied successfully!', 'success');
}

function updateFilterTags() {
    const filterTagsContainer = document.getElementById('filterTags');
    if (!filterTagsContainer) return;
    filterTagsContainer.innerHTML = '';
    if (searchQuery) {
        filterTagsContainer.innerHTML += `<span class="filter-tag">Search: "${searchQuery}"<button class="remove-filter" onclick="clearSearch()"><i class="fas fa-times"></i></button></span>`;
    }
    if (activeFilters.contentType !== 'all') {
        let typeText = '';
        switch(activeFilters.contentType) { 
            case 'censored': typeText = 'Censored'; break; 
            case 'uncensored': typeText = 'Uncensored'; break; 
            case 'Straight': typeText = 'Straight'; break; 
            case 'LGBT': typeText = 'LGBT'; break; 
        }
        filterTagsContainer.innerHTML += `<span class="filter-tag">Type: ${typeText}<button class="remove-filter" onclick="removeFilter('contentType')"><i class="fas fa-times"></i></button></span>`;
    }
    if (activeFilters.hasDownload !== 'all') {
        filterTagsContainer.innerHTML += `<span class="filter-tag">Download: ${activeFilters.hasDownload === 'yes' ? 'Yes' : 'No'}<button class="remove-filter" onclick="removeFilter('hasDownload')"><i class="fas fa-times"></i></button></span>`;
    }
    if (activeFilters.hasTrailer !== 'all') {
        filterTagsContainer.innerHTML += `<span class="filter-tag">Trailer: ${activeFilters.hasTrailer === 'yes' ? 'Yes' : 'No'}<button class="remove-filter" onclick="removeFilter('hasTrailer')"><i class="fas fa-times"></i></button></span>`;
    }
    if (activeFilters.hasRating !== 'all') {
        filterTagsContainer.innerHTML += `<span class="filter-tag">Rating: ${activeFilters.hasRating === 'yes' ? 'Yes' : 'No'}<button class="remove-filter" onclick="removeFilter('hasRating')"><i class="fas fa-times"></i></button></span>`;
    }
    if (activeFilters.hotOnly) {
        filterTagsContainer.innerHTML += `<span class="filter-tag">HOT Posts Only<button class="remove-filter" onclick="removeFilter('hotOnly')"><i class="fas fa-times"></i></button></span>`;
    }
}

function clearSearch() {
    searchQuery = '';
    const searchInput = document.getElementById('searchPosts');
    if (searchInput) searchInput.value = '';
    currentPage = 1;
    renderPostHistory();
}

function removeFilter(filterName) {
    switch(filterName) {
        case 'contentType': activeFilters.contentType = 'all'; break;
        case 'hasDownload': activeFilters.hasDownload = 'all'; break;
        case 'hasTrailer': activeFilters.hasTrailer = 'all'; break;
        case 'hasRating': activeFilters.hasRating = 'all'; break;
        case 'hotOnly': activeFilters.hotOnly = false; break;
    }
    currentPage = 1;
    renderPostHistory();
}

function goToPage(page) {
    if (page < 1 || page > Math.ceil(allPosts.length / postsPerPage)) return;
    currentPage = page;
    renderPostHistory();
    const historySection = document.getElementById('postHistory');
    if (historySection) historySection.scrollIntoView({ behavior: 'smooth' });
}

function quickViewPost(postId) {
    const post = allPosts.find(p => p.ID == postId);
    if (!post) { showAlert("Post not found", "danger"); return; }
    const contentType = post.ContentType || 'movie';
    const hasDownload = post.HasDownload === "TRUE" || post.HasDownload === true;
    const isHotPost = post.IsHot === "TRUE" || post.IsHot === true;
    const hasRating = post.Rating && parseFloat(post.Rating) > 0;
    const ratingValue = hasRating ? parseFloat(post.Rating) : 0;
    let displayDate = post.CreatedAt;
    try {
        const date = new Date(post.CreatedAt);
        if (!isNaN(date.getTime())) {
            displayDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    } catch (e) { console.warn('Date formatting error:', e); }
    const modalHTML = `<div class="modal fade" id="quickViewModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"><i class="fas fa-eye me-2"></i>Quick View${isHotPost ? '<span class="badge bg-danger ms-2"><i class="fas fa-fire me-1"></i>HOT</span>' : ''}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body quick-view-content">${post.ImageURL ? `<img src="${post.ImageURL}" alt="${post.Title}" class="quick-view-image" onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'">` : ''}<h3 class="quick-view-title">${post.Title || 'Untitled Post'}</h3><div class="quick-view-meta"><span class="badge ${getContentTypeClass(contentType)}"><i class="${getContentTypeIcon(contentType)} me-1"></i>${contentType.charAt(0).toUpperCase() + contentType.slice(1)}</span><span class="text-muted"><i class="far fa-calendar me-1"></i>${displayDate}</span><span class="text-muted"><i class="fas fa-hashtag me-1"></i>ID: ${post.ID}</span>${hasRating ? `<span class="text-warning"><i class="fas fa-star me-1"></i>${ratingValue}/10</span>` : ''}</div>${post.Genres ? `<div class="mb-3"><strong>Genres:</strong>${post.Genres.split(',').map(g => `<span class="badge bg-purple me-1">${g.trim()}</span>`).join('')}</div>` : ''}<div class="quick-view-content-text">${post.Paragraph || 'No content available'}</div><div class="quick-view-links">${post.TrailerLink ? `<div class="mb-2"><strong>Trailer Link:</strong><a href="${post.TrailerLink}" target="_blank" class="ms-2">${post.TrailerLink}</a></div>` : ''}${hasDownload && post.DownloadLink ? `<div class="mb-2"><strong>Download Link:</strong><a href="${post.DownloadLink}" target="_blank" class="ms-2">${post.DownloadLink}</a></div>` : ''}</div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="button" class="btn btn-primary" onclick="editPost('${post.ID}')"><i class="fas fa-edit me-1"></i>Edit Post</button></div></div></div></div>`;
    const existingModal = document.getElementById('quickViewModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('quickViewModal'));
    modal.show();
}

function getContentTypeClass(type) {
    switch(type) { 
        case 'censored': return 'bg-censored'; 
        case 'uncensored': return 'bg-uncensored'; 
        case 'Straight': return 'bg-straight'; 
        case 'LGBT': return 'bg-lgbt'; 
        default: return 'bg-primary'; 
    }
}

function getContentTypeIcon(type) {
    switch(type) { 
        case 'censored': return 'fas fa-eye-slash'; 
        case 'uncensored': return 'fas fa-eye'; 
        case 'Straight': return 'fas fa-venus-mars'; 
        case 'LGBT': return 'fas fa-rainbow'; 
        default: return 'fas fa-file'; 
    }
}

function resetFilters() {
    searchQuery = '';
    currentPage = 1;
    activeFilters = { hotOnly: false, contentType: 'all', hasDownload: 'all', hasTrailer: 'all', hasRating: 'all' };
    const searchInput = document.getElementById('searchPosts');
    if (searchInput) searchInput.value = '';
    renderPostHistory();
    showAlert("All filters cleared", "success");
}

// ==================== STATS FUNCTIONS ====================
async function loadStats() {
    const statsContainer = document.getElementById("statsContainer");
    if (!statsContainer) return;
    
    const totalPosts = allPosts.length;
    const postsWithDownload = allPosts.filter(p => p.HasDownload === "TRUE" || p.HasDownload === true).length;
    const postsWithImages = allPosts.filter(p => p.ImageURL && p.ImageURL.trim() !== '').length;
    const postsWithTrailer = allPosts.filter(p => p.TrailerLink && p.TrailerLink.trim() !== '').length;
    const postsWithRating = allPosts.filter(p => p.Rating && parseFloat(p.Rating) > 0).length;
    const postsWithGenres = allPosts.filter(p => p.Genres && p.Genres.trim() !== '').length;
    const hotPosts = allPosts.filter(p => p.IsHot === "TRUE" || p.IsHot === true).length;
    const censoredPosts = allPosts.filter(p => p.ContentType === 'censored').length;
    const uncensoredPosts = allPosts.filter(p => p.ContentType === 'uncensored').length;
    const straightPosts = allPosts.filter(p => p.ContentType === 'Straight').length;
    const lgbtPosts = allPosts.filter(p => p.ContentType === 'LGBT').length;
    statsContainer.innerHTML = `<div class="row text-center"><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-primary">${totalPosts}</h3><p class="mb-0 small">Total Posts</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-danger">${hotPosts}</h3><p class="mb-0 small">HOT Posts</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-success">${postsWithDownload}</h3><p class="mb-0 small">With Downloads</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-info">${postsWithImages}</h3><p class="mb-0 small">With Images</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-warning">${postsWithTrailer}</h3><p class="mb-0 small">With Trailer</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-censored">${censoredPosts}</h3><p class="mb-0 small">Censored</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-uncensored">${uncensoredPosts}</h3><p class="mb-0 small">Uncensored</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-straight">${straightPosts}</h3><p class="mb-0 small">Straight</p></div></div><div class="col-6 col-md-3 mb-3"><div class="p-3 bg-light rounded"><h3 class="text-lgbt">${lgbtPosts}</h3><p class="mb-0 small">LGBT</p></div></div></div><div class="mt-3"><small class="text-muted"><i class="fas fa-info-circle me-1"></i>Last updated: ${new Date().toLocaleTimeString()}</small><button class="btn btn-sm btn-outline-secondary ms-2" onclick="loadStats()"><i class="fas fa-sync-alt"></i></button></div>`;
}

// ==================== UPDATE POST WITH FETCH ====================
function editPost(postId) {
    const post = allPosts.find(p => p.ID == postId);
    if (!post) { showAlert("Post not found", "danger"); return; }
    document.getElementById("editId").value = post.ID;
    document.getElementById("editTitle").value = post.Title || '';
    const editParagraph = document.getElementById('editParagraph');
    if (editParagraph) editParagraph.innerHTML = post.Paragraph || '';
    editParagraphValue = post.Paragraph || '';
    document.getElementById("editImageURL").value = post.ImageURL || '';
    document.getElementById("editTrailerLink").value = post.TrailerLink || '';
    document.getElementById("editDownloadLink").value = post.DownloadLink || '';
    const hasDownload = post.HasDownload === "TRUE" || post.HasDownload === true;
    const isHot = post.IsHot === "TRUE" || post.IsHot === true;
    document.getElementById("editHasDownload").checked = hasDownload;
    document.getElementById("editIsHot").checked = isHot;
    editCurrentIsHot = isHot;
    updateEditHotIndicator();
    const contentType = post.ContentType || 'movie';
    editCurrentContentType = contentType;
    // Map content type to edit radio values
    let editRadioValue = 'movie';
    if (contentType === 'censored') editRadioValue = 'movie';
    else if (contentType === 'uncensored') editRadioValue = 'movie';
    else if (contentType === 'Straight') editRadioValue = 'series';
    else if (contentType === 'LGBT') editRadioValue = 'animation';
    const editContentTypeRadio = document.querySelector(`input[name="editContentType"][value="${editRadioValue}"]`);
    if (editContentTypeRadio) editContentTypeRadio.checked = true;
    editSelectedGenres = post.Genres ? post.Genres.split(',').map(g => g.trim()).filter(g => g) : [];
    updateEditGenresDisplay();
    editCurrentRating = post.Rating ? parseFloat(post.Rating) : 0;
    updateEditRatingDisplay();
    const editModal = new bootstrap.Modal(document.getElementById("editModal"));
    editModal.show();
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function updatePost() {
    const postId = document.getElementById("editId").value;
    const title = document.getElementById("editTitle").value.trim();
    const imageURL = document.getElementById("editImageURL").value.trim();
    const trailerLink = document.getElementById("editTrailerLink").value.trim();
    const downloadLink = document.getElementById("editDownloadLink").value.trim();
    const hasDownload = document.getElementById("editHasDownload").checked;
    const isHot = editCurrentIsHot;
    const contentType = editCurrentContentType;
    const genres = editSelectedGenres.join(', ');
    const rating = editCurrentRating;
    if (!title || !editParagraphValue || !imageURL) {
        showAlert("Please fill in all required fields", "warning");
        return;
    }
    let finalImageURL = convertEditGoogleDriveUrl(imageURL);
    if (imageURL !== finalImageURL) {
        debugLog('Google Drive URL auto-converted (edit):', finalImageURL);
        showAlert("Google Drive URL detected and auto-converted to thumbnail link", "info");
    }
    
    const updateBtn = document.querySelector('#editModal .btn-primary');
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
    updateBtn.disabled = true;

    try {
        const params = new URLSearchParams();
        params.append('action', 'updatePost');
        params.append('id', postId);
        params.append('title', title);
        params.append('paragraph', editParagraphValue);
        params.append('imageURL', finalImageURL);
        params.append('trailerLink', trailerLink);
        params.append('downloadLink', downloadLink);
        params.append('hasDownload', hasDownload ? 'true' : 'false');
        params.append('genres', genres);
        params.append('rating', rating);
        params.append('isHot', isHot ? 'true' : 'false');
        params.append('contentType', contentType);
        params.append('from', 'mmovie.site');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Invalid server response');
        }
        
        if (result.success) {
            showAlert("Post updated successfully!", "success");
            bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
            await loadPostsWithFetch();
            await loadStats();
        } else {
            showAlert(result.message || "Error updating post. Please try again.", "danger");
        }
    } catch (error) {
        console.error("Update error:", error);
        showAlert("Error: " + error.message, "danger");
    } finally {
        updateBtn.innerHTML = originalText;
        updateBtn.disabled = false;
    }
}

async function deletePost(postId) {
    if(!confirm("Are you sure you want to delete this post?\n\nThis action cannot be undone and the post will be permanently removed from the blog.")) { return; }
    debugLog('Deleting post ID:', postId);
    
    const deleteBtn = document.querySelector(`button[onclick="deletePost('${postId}')"]`);
    const originalText = deleteBtn ? deleteBtn.innerHTML : 'Delete';
    if (deleteBtn) {
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteBtn.disabled = true;
    }
    
    try {
        const params = new URLSearchParams();
        params.append('action', 'deletePost');
        params.append('id', postId);
        params.append('from', 'mmovie.site');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Invalid server response');
        }
        
        if (result.success) {
            showAlert("Post deleted successfully!", "success");
            await loadPostsWithFetch();
            await loadStats();
        } else {
            showAlert(result.message || "Error deleting post. Please try again.", "danger");
        }
    } catch (error) {
        console.error("Delete error:", error);
        showAlert("Error: " + error.message, "danger");
    } finally {
        if (deleteBtn) {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
        }
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showAlert(message, type) {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => { if (alert.parentElement) alert.remove(); });
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `<div class="d-flex align-items-center"><i class="fas ${getAlertIcon(type)} me-2"></i><div class="flex-grow-1">${message}</div><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
    const container = document.querySelector(".admin-container");
    if (container && container.firstChild) {
        container.insertBefore(alertDiv, container.firstChild);
    } else if (container) {
        container.appendChild(alertDiv);
    } else {
        document.body.appendChild(alertDiv);
    }
    setTimeout(() => { if (alertDiv.parentElement) alertDiv.remove(); }, 5000);
}

function getAlertIcon(type) {
    switch(type) { case 'success': return 'fa-check-circle'; case 'danger': return 'fa-exclamation-circle'; case 'warning': return 'fa-exclamation-triangle'; case 'info': return 'fa-info-circle'; default: return 'fa-info-circle'; }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') { login(); }
}

function addRealTimePreview() {
    const imageInput = document.getElementById('imageURL');
    const editImageInput = document.getElementById('editImageURL');
    if (imageInput) {
        imageInput.addEventListener('blur', function() {
            const url = this.value.trim();
            if (url) {
                const converted = convertGoogleDriveUrl(url);
                if (url !== converted) {
                    debugLog('Auto-converting Google Drive URL on blur');
                    showAlert("Google Drive URL detected and will be auto-converted", "info");
                }
            }
        });
    }
    if (editImageInput) {
        editImageInput.addEventListener('blur', function() {
            const url = this.value.trim();
            if (url) {
                const converted = convertEditGoogleDriveUrl(url);
                if (url !== converted) {
                    debugLog('Auto-converting Google Drive URL on blur (edit)');
                    showAlert("Google Drive URL detected and will be auto-converted", "info");
                }
            }
        });
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    debugLog('Admin panel loaded');
    initGenres();
    initRating();
    initHotFeature();
    initContentType();
    
    const genreInput = document.getElementById('genreInput');
    if (genreInput) {
        genreInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); addGenreFromInput(); }
        });
    }
    const editGenreInput = document.getElementById('editGenreInput');
    if (editGenreInput) {
        editGenreInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); addEditGenreFromInput(); }
        });
    }
    
    addRealTimePreview();
    
    const isLoggedIn = checkExistingLogin();
    if (!isLoggedIn) { 
        const emailField = document.getElementById('email');
        if (emailField) emailField.focus(); 
    }
    
    const passwordField = document.getElementById('password');
    if (passwordField) passwordField.addEventListener('keypress', handleKeyPress);
    const otpCode = document.getElementById('otpCode');
    if (otpCode) {
        otpCode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { verifyOTP(); }
        });
    }
    
    if (document.getElementById('adsListContainer')) {
        loadAds();
    }
});