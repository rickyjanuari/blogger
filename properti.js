// ============================================
// PROPERTI LISTING APP – Vanilla JS
// Stack: Google Sheets API + Cloudinary
// ============================================

var ric = window.requestIdleCallback || function(cb){ setTimeout(cb, 1); };

// GANTI DENGAN URL APPS SCRIPT KAMU
var API_URL    = 'https://script.google.com/macros/s/AKfycbwkdqP91371wKdNyO2WUyWphthmJk90rS5LiaSR_BtV74gMTDYC6uTmNv7EfQDCrkSr/exec';
var CLOUD_NAME = 'YOUR_CLOUD_NAME';
var UPLOAD_PRESET = 'YOUR_PRESET';

// ============================================
// DOM HELPER
// ============================================
var DOM = {
  el: function(id){ return document.getElementById(id); },
  loading: function(id){
    var el = this.el(id);
    if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat data...</div>';
  },
  error: function(id, retryFn){
    var el = this.el(id);
    if (!el) return;
    el.innerHTML =
      '<div class="error-state">' +
      '<div class="e-icon">&#128268;</div>' +
      '<p>Gagal memuat data.<br/>Periksa koneksi internet.</p>' +
      '<button class="retry-btn" onclick="'+retryFn+'">&#8635; Coba Lagi</button>' +
      '</div>';
  }
};

function apiFetch(url, onSuccess, onError) {
  return fetch(url)
    .then(function(r){ return r.json(); })
    .then(onSuccess)
    .catch(onError || function(){});
}

function formatHarga(n) {
  var num = Number(n);
  if (num >= 1e9)  return (num/1e9).toFixed(1).replace('.0','') + ' M';
  if (num >= 1e6)  return (num/1e6).toFixed(0) + ' Jt';
  if (num >= 1e3)  return (num/1e3).toFixed(0) + ' Rb';
  return 'Rp ' + num.toLocaleString('id-ID');
}

// ============================================
// ROUTER (hash based)
// ============================================
var Router = (function(){
  var _history = ['home'];
  var _loaded  = {};
  var PAGES    = ['home','cari','detail','pasang','tentang'];

  function go(pageId) {
    PAGES.forEach(function(id){
      var el = DOM.el('page-' + id);
      if (el) el.style.display = 'none';
    });
    var target = DOM.el('page-' + pageId);
    if (!target) return;
    target.style.display = 'block';
    window.scrollTo(0, 0);
    location.hash = pageId === 'home' ? '' : pageId;

    document.querySelectorAll('.nav-item').forEach(function(n){
      n.classList.toggle('active', n.dataset.page === pageId);
    });

    if (!_loaded[pageId]) {
      _loaded[pageId] = true;
      if (pageId === 'home') App.loadHome();
      if (pageId === 'cari') App.loadCari();
    }

    if (_history[_history.length-1] !== pageId) _history.push(pageId);
  }

  function back() {
    _history.pop();
    go(_history[_history.length-1] || 'home');
  }

  window.addEventListener('hashchange', function(){
    var h = location.hash.replace('#','');
    if (h && PAGES.indexOf(h) !== -1) go(h);
  });

  return { go: go, back: back };
})();


// ============================================
// CLOUDINARY UPLOAD
// ============================================
var Uploader = {
  upload: function(file, onSuccess, onProgress) {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('folder', 'properti');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload');

    xhr.upload.onprogress = function(e) {
      if (onProgress && e.lengthComputable)
        onProgress(Math.round(e.loaded / e.total * 100));
    };

    xhr.onload = function() {
      try {
        var res = JSON.parse(xhr.responseText);
        if (res.secure_url) onSuccess(res.secure_url);
        else onSuccess('');
      } catch(e) { onSuccess(''); }
    };

    xhr.onerror = function(){ onSuccess(''); };
    xhr.send(fd);
  }
};


// ============================================
// MAIN APP
// ============================================
var App = (function(){
  var _allListings = [];
  var _activeDetail = null;
  var _filter = { tipe: 'semua', min: '', max: '', q: '' };
  var _favorites = JSON.parse(localStorage.getItem('favProps') || '[]');

  // ===== HOME =====
  function loadHome() {
    DOM.loading('home-featured');
    DOM.loading('home-kosan');

    apiFetch(API_URL + '?tipe=semua',
      function(d) {
        if (!d || !d.data) return;
        _allListings = d.data;
        renderFeatured(_allListings.slice(0, 6));

        var kosan = _allListings.filter(function(l){
          return l.tipe === 'kosan' || l.tipe === 'kontrakan';
        }).slice(0, 4);
        renderCards(kosan, 'home-kosan');

        // Stats
        var stats = { dijual: 0, disewa: 0 };
        _allListings.forEach(function(l){
          if (l.status === 'dijual') stats.dijual++;
          else stats.disewa++;
        });
        if (DOM.el('stat-dijual')) DOM.el('stat-dijual').textContent = stats.dijual;
        if (DOM.el('stat-disewa')) DOM.el('stat-disewa').textContent = stats.disewa;
        if (DOM.el('stat-total'))  DOM.el('stat-total').textContent  = _allListings.length;
      },
      function(){ DOM.error('home-featured', 'App.loadHome()'); }
    );
  }

  function renderFeatured(list) {
    var container = DOM.el('home-featured');
    if (!container) return;
    if (!list.length) { container.innerHTML = '<p style="padding:20px;text-align:center;color:#999">Belum ada listing</p>'; return; }
    container.innerHTML = '';
    list.forEach(function(item) {
      container.appendChild(makeCard(item));
    });
  }

  function renderCards(list, containerId) {
    var container = DOM.el(containerId);
    if (!container) return;
    if (!list.length) { container.innerHTML = '<p style="padding:20px;text-align:center;color:#999">Tidak ditemukan</p>'; return; }
    container.innerHTML = '';
    list.forEach(function(item){ container.appendChild(makeCard(item)); });
  }

  function makeCard(item) {
    var isFav = _favorites.indexOf(item.id) !== -1;
    var fotoArr = [];
    try { fotoArr = typeof item.foto === 'string' ? JSON.parse(item.foto) : (item.foto || []); } catch(e){}
    var thumb = fotoArr.length ? fotoArr[0] : 'https://via.placeholder.com/300x200?text=Properti';

    var card = document.createElement('div');
    card.className = 'prop-card';
    card.innerHTML =
      '<div class="prop-img">' +
        '<img src="'+thumb+'" loading="lazy" decoding="async" alt="'+item.judul+'"/>' +
        '<span class="prop-badge '+item.status+'">'+item.status+'</span>' +
        '<button class="fav-btn '+(isFav?'active':'')+'" onclick="App.toggleFav(\''+item.id+'\',this)" title="Favorit">&#9829;</button>' +
      '</div>' +
      '<div class="prop-info">' +
        '<div class="prop-tipe">'+item.tipe+'</div>' +
        '<div class="prop-judul">'+item.judul+'</div>' +
        '<div class="prop-harga">Rp '+Number(item.harga).toLocaleString('id-ID')+'</div>' +
        '<div class="prop-meta">' +
          '<span>&#128205; '+item.lokasi+'</span>' +
        '</div>' +
        (item.luasTanah ? '<div class="prop-specs">'+
          (item.luasTanah  ? '<span>LT: '+item.luasTanah+'m&#178;</span>' : '')+
          (item.luasBangunan ? '<span>LB: '+item.luasBangunan+'m&#178;</span>' : '')+
          (item.kamarTidur  ? '<span>KT: '+item.kamarTidur+'</span>' : '')+
          (item.kamarMandi  ? '<span>KM: '+item.kamarMandi+'</span>' : '')+
        '</div>' : '') +
      '</div>';
    card.onclick = function(e){ if (!e.target.classList.contains('fav-btn')) openDetail(item); };
    return card;
  }

  // ===== DETAIL =====
  function openDetail(item) {
    _activeDetail = item;
    Router.go('detail');

    var fotoArr = [];
    try { fotoArr = typeof item.foto === 'string' ? JSON.parse(item.foto) : (item.foto || []); } catch(e){}

    var fotos = fotoArr.length
      ? fotoArr.map(function(f){ return '<img src="'+f+'" loading="lazy" alt="foto"/>'; }).join('')
      : '<div class="no-foto">&#127968;</div>';

    var waUrl = 'https://wa.me/' + String(item.wa||item.kontak||'').replace(/\D/g,'') +
      '?text=' + encodeURIComponent('Halo, saya tertarik dengan: '+item.judul+' ('+item.lokasi+')');

    DOM.el('detail-title').textContent = item.judul || '';
    DOM.el('detail-content').innerHTML =
      '<div class="detail-gallery">' + fotos + '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-badge-row">' +
          '<span class="prop-badge '+item.status+'">'+item.status+'</span>' +
          '<span class="prop-tipe-badge">'+item.tipe+'</span>' +
        '</div>' +
        '<div class="detail-harga">Rp '+Number(item.harga).toLocaleString('id-ID')+'</div>' +
        '<div class="detail-lokasi">&#128205; '+item.lokasi+'</div>' +
        (item.lat && item.lng ?
          '<iframe class="detail-map" loading="lazy" allowfullscreen src="https://maps.google.com/maps?q='+item.lat+','+item.lng+'&z=15&output=embed"></iframe>'
          : '') +
        '<div class="detail-specs">' +
          (item.luasTanah     ? '<div class="spec-item"><span>Luas Tanah</span><strong>'+item.luasTanah+' m&#178;</strong></div>' : '') +
          (item.luasBangunan  ? '<div class="spec-item"><span>Luas Bangunan</span><strong>'+item.luasBangunan+' m&#178;</strong></div>' : '') +
          (item.kamarTidur    ? '<div class="spec-item"><span>Kamar Tidur</span><strong>'+item.kamarTidur+' KT</strong></div>' : '') +
          (item.kamarMandi    ? '<div class="spec-item"><span>Kamar Mandi</span><strong>'+item.kamarMandi+' KM</strong></div>' : '') +
        '</div>' +
        (item.deskripsi ? '<div class="detail-desc"><h3>Deskripsi</h3><p>'+item.deskripsi+'</p></div>' : '') +
        '<div class="detail-contact">' +
          '<a class="btn-wa" href="'+waUrl+'" target="_blank">&#128222; WhatsApp Pemilik</a>' +
          '<a class="btn-telp" href="tel:'+item.kontak+'">&#128379; Telepon</a>' +
        '</div>' +
        '<button class="btn-share" onclick="App.shareDetail()">&#128279; Bagikan</button>' +
      '</div>';
  }

  function shareDetail() {
    if (!_activeDetail) return;
    var text = _activeDetail.judul + '\n' + _activeDetail.lokasi + '\nRp ' + Number(_activeDetail.harga).toLocaleString('id-ID');
    if (navigator.share) {
      navigator.share({ title: _activeDetail.judul, text: text, url: location.href });
    } else {
      navigator.clipboard && navigator.clipboard.writeText(text + '\n' + location.href);
      alert('Link berhasil disalin!');
    }
  }

  // ===== CARI / FILTER =====
  function loadCari() {
    if (!_allListings.length) {
      DOM.loading('cari-result');
      apiFetch(API_URL + '?tipe=semua',
        function(d) {
          if (d && d.data) { _allListings = d.data; filterAndRender(); }
        }
      );
    } else {
      filterAndRender();
    }
  }

  function doFilter() {
    _filter.tipe = DOM.el('filter-tipe') ? DOM.el('filter-tipe').value : 'semua';
    _filter.min  = DOM.el('filter-min')  ? DOM.el('filter-min').value  : '';
    _filter.max  = DOM.el('filter-max')  ? DOM.el('filter-max').value  : '';
    _filter.q    = DOM.el('filter-q')    ? DOM.el('filter-q').value    : '';
    filterAndRender();
  }

  function filterAndRender() {
    var list = _allListings.slice();
    if (_filter.tipe && _filter.tipe !== 'semua') list = list.filter(function(l){ return l.tipe === _filter.tipe; });
    if (_filter.min)  list = list.filter(function(l){ return Number(l.harga) >= Number(_filter.min); });
    if (_filter.max)  list = list.filter(function(l){ return Number(l.harga) <= Number(_filter.max); });
    if (_filter.q) {
      var kw = _filter.q.toLowerCase();
      list = list.filter(function(l){
        return (l.judul||'').toLowerCase().indexOf(kw)    !== -1 ||
               (l.lokasi||'').toLowerCase().indexOf(kw)   !== -1 ||
               (l.deskripsi||'').toLowerCase().indexOf(kw)!== -1;
      });
    }
    var info = DOM.el('cari-info');
    if (info) info.textContent = list.length + ' properti ditemukan';
    renderCards(list, 'cari-result');
  }

  // ===== FAVORIT =====
  function toggleFav(id, btn) {
    var idx = _favorites.indexOf(id);
    if (idx === -1) { _favorites.push(id); btn.classList.add('active'); }
    else { _favorites.splice(idx, 1); btn.classList.remove('active'); }
    localStorage.setItem('favProps', JSON.stringify(_favorites));
  }

  // ===== FORM PASANG IKLAN =====
  var _uploadedFotos = [];

  function initFormUpload() {
    var inp = DOM.el('form-foto-input');
    if (!inp) return;
    inp.addEventListener('change', function() {
      Array.from(inp.files).forEach(function(file) {
        var progress = DOM.el('upload-progress');
        if (progress) progress.style.display = 'block';
        Uploader.upload(
          file,
          function(url) {
            if (url) {
              _uploadedFotos.push(url);
              var preview = DOM.el('foto-preview');
              if (preview) {
                var img = document.createElement('img');
                img.src = url;
                img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;margin:4px';
                preview.appendChild(img);
              }
            }
            if (progress) progress.style.display = 'none';
          },
          function(pct) {
            var bar = DOM.el('progress-bar');
            if (bar) bar.style.width = pct + '%';
          }
        );
      });
    });
  }

  function submitListing() {
    var btn = DOM.el('submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

    var data = {
      tipe:          DOM.el('f-tipe') ? DOM.el('f-tipe').value : '',
      status:        DOM.el('f-status') ? DOM.el('f-status').value : '',
      judul:         DOM.el('f-judul') ? DOM.el('f-judul').value : '',
      harga:         DOM.el('f-harga') ? DOM.el('f-harga').value : '',
      lokasi:        DOM.el('f-lokasi') ? DOM.el('f-lokasi').value : '',
      luasTanah:     DOM.el('f-lt') ? DOM.el('f-lt').value : '',
      luasBangunan:  DOM.el('f-lb') ? DOM.el('f-lb').value : '',
      kamarTidur:    DOM.el('f-kt') ? DOM.el('f-kt').value : '',
      kamarMandi:    DOM.el('f-km') ? DOM.el('f-km').value : '',
      kontak:        DOM.el('f-kontak') ? DOM.el('f-kontak').value : '',
      wa:            DOM.el('f-wa') ? DOM.el('f-wa').value : '',
      deskripsi:     DOM.el('f-deskripsi') ? DOM.el('f-deskripsi').value : '',
      foto:          JSON.stringify(_uploadedFotos)
    };

    // Validasi
    if (!data.judul || !data.harga || !data.lokasi || !data.kontak) {
      alert('Mohon lengkapi data: Judul, Harga, Lokasi, dan Kontak.');
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim Iklan'; }
      return;
    }

    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    })
    .then(function(r){ return r.json(); })
    .then(function(res) {
      if (res.status) {
        alert('&#10003; Iklan berhasil dikirim!\nIklan akan tayang setelah ditinjau admin.');
        _uploadedFotos = [];
        DOM.el('pasang-form').reset();
        DOM.el('foto-preview').innerHTML = '';
        Router.go('home');
      } else {
        alert('Gagal: ' + (res.message || 'Coba lagi'));
      }
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim Iklan'; }
    })
    .catch(function() {
      alert('Gagal mengirim. Coba lagi.');
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim Iklan'; }
    });
  }

  return {
    loadHome:      loadHome,
    loadCari:      loadCari,
    openDetail:    openDetail,
    doFilter:      doFilter,
    toggleFav:     toggleFav,
    shareDetail:   shareDetail,
    initFormUpload:initFormUpload,
    submitListing: submitListing
  };
})();


// ============================================
// INIT
// ============================================
window.addEventListener('load', function() {
  var sk = document.getElementById('app-skeleton');
  if (sk) sk.remove();

  document.getElementById('page-home').style.display = 'block';

  App.loadHome();
  App.initFormUpload();

  var hash = location.hash.replace('#','');
  if (hash) Router.go(hash);
});
