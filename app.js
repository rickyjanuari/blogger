// ============================================
// DZIKIR APP — Vanilla JS
// GitHub: USERNAME/REPO/app.js
// ============================================

var ric = window.requestIdleCallback || function(cb){ setTimeout(cb, 1); };

// ============================================
// ROUTER
// ============================================
var Router = (function(){
  var history  = ['home'];
  var loaded   = {};
  var PAGES    = ['home','quran','surah','dzikir-pagi','dzikir-petang','doa','asmaul','shalat','artikel','post','tentang'];

  function go(pageId) {
    PAGES.forEach(function(id){
      var el = document.getElementById('page-' + id);
      if (el) el.style.display = 'none';
    });
    var target = document.getElementById('page-' + pageId);
    if (!target) return;

    target.style.display = 'block';
    window.scrollTo(0, 0);
    location.hash = pageId === 'home' ? '' : pageId.split(':')[0];

    document.querySelectorAll('.nav-item').forEach(function(n){
      n.classList.toggle('active', n.dataset.page === pageId);
    });

    if (!loaded[pageId]) {
      loaded[pageId] = true;
      if (pageId === 'quran')        Quran.loadList();
      if (pageId === 'dzikir-pagi')  Dzikir.load('pagi',  'list-dzikir-pagi');
      if (pageId === 'dzikir-petang')Dzikir.load('petang','list-dzikir-petang');
      if (pageId === 'doa')          Dzikir.load('doa',   'list-doa');
      if (pageId === 'asmaul')       Asmaul.load();
      if (pageId === 'shalat')       Dzikir.load('shalat','list-shalat');
      if (pageId === 'artikel')      Artikel.load();
    }

    if (history[history.length - 1] !== pageId) history.push(pageId);
  }

  function back() {
    history.pop();
    go(history[history.length - 1] || 'home');
  }

  function init() {
    var hash = location.hash.replace('#','');
    // Cek pending post dari redirect
    var pending = sessionStorage.getItem('pendingPost');
    if (pending) {
      go('post');
      PostReader.load(pending);
      return;
    }
    if (hash && hash !== 'home') go(hash);
    else go('home');
  }

  window.addEventListener('hashchange', function(){
    var hash = location.hash.replace('#','');
    if (hash && hash !== 'post') go(hash);
  });

  return { go: go, back: back, init: init };
})();


// ============================================
// DOM HELPER
// ============================================
var DOM = {
  el: function(id){ return document.getElementById(id); },

  loading: function(id){
    var el = this.el(id);
    if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';
  },

  error: function(id, retry){
    var el = this.el(id);
    if (!el) return;
    el.innerHTML = '<div class="error-state">'
      + '<div class="e-icon">&#128268;</div>'
      + '<p>Gagal memuat data.<br/>Periksa koneksi internet.</p>'
      + '<button class="retry-btn" onclick="' + retry + '()">&#8635; Coba Lagi</button>'
      + '</div>';
  },

  frag: function(items, renderFn){
    var frag = document.createDocumentFragment();
    items.forEach(function(item, i){ frag.appendChild(renderFn(item, i)); });
    return frag;
  }
};


// ============================================
// API FETCH WRAPPER
// ============================================
function apiFetch(url, onSuccess, onError) {
  return fetch(url)
    .then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(onSuccess)
    .catch(onError || function(){});
}


// ============================================
// JAM REAL-TIME
// ============================================
var Jam = (function(){
  var HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var timer = null;

  function tick() {
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    DOM.el('hero-jam').textContent =
      String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    DOM.el('hero-salam').textContent =
      h>=4&&h<11 ? 'Selamat Pagi' : h>=11&&h<15 ? 'Selamat Siang' : h>=15&&h<18 ? 'Selamat Sore' : 'Selamat Malam';
    DOM.el('hero-tanggal').textContent =
      HARI[now.getDay()] + ', ' + now.getDate() + ' ' + BULAN[now.getMonth()] + ' ' + now.getFullYear();
  }

  function start() { tick(); timer = setInterval(tick, 1000); }
  function stop()  { clearInterval(timer); }

  return { start: start, stop: stop };
})();


// ============================================
// JADWAL SHALAT
// ============================================
var Shalat = {
  load: function() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function(pos) {
      var now = new Date();
      var url = 'https://api.aladhan.com/v1/timings/'
        + now.getDate() + '-' + (now.getMonth()+1) + '-' + now.getFullYear()
        + '?latitude=' + pos.coords.latitude
        + '&longitude=' + pos.coords.longitude
        + '&method=11';

      apiFetch(url, function(d) {
        var t    = d.data.timings;
        var now2 = new Date();
        var nowMin = now2.getHours()*60 + now2.getMinutes();
        var map  = { subuh:t.Fajr, dzuhur:t.Dhuhr, ashar:t.Asr, maghrib:t.Maghrib, isya:t.Isha };
        var keys = ['subuh','dzuhur','ashar','maghrib','isya'];
        var vals = [t.Fajr, t.Dhuhr, t.Asr, t.Maghrib, t.Isha];
        var marked = false;

        keys.forEach(function(key, i) {
          var el = DOM.el('s-' + key);
          if (!el) return;
          el.querySelector('span:last-child').textContent = vals[i];
          if (!marked) {
            var p = vals[i].split(':');
            if (parseInt(p[0])*60 + parseInt(p[1]) > nowMin) {
              el.classList.add('aktif'); marked = true;
            }
          }
        });
      });
    }, null, { timeout: 8000 });
  }
};


var Nasihat = {
  load: function() {
    apiFetch('https://api.myquran.com/v2/doa/acak',
      function(d) {
        if (!d || !d.data) {
          setFallback();
          return;
        }

        var data   = d.data;
        // Dari contoh respons:
        // data.doa     = teks Arab
        // data.artinya = terjemahan Indonesia
        var teksAr  = data.doa || '';
        var teksId  = data.artinya || '';
        var judul   = data.judul || 'Doa Harian';

        if (!teksAr && !teksId) {
          setFallback();
          return;
        }

        // Tampilkan: Arab (jika ada), lalu garis, lalu arti
        var line = '';
        if (teksAr) line += teksAr + ' — ';
        if (teksId) line += teksId;

        DOM.el('nasihat-text').textContent = '\u201c' + line + '\u201d';
        DOM.el('nasihat-src').textContent  = judul;
      },
      function() {
        setFallback();
      }
    );

    function setFallback() {
      DOM.el('nasihat-text').textContent =
        '\u201cSesungguhnya bersama kesulitan ada kemudahan.\u201d';
      DOM.el('nasihat-src').textContent  = 'QS. Al-Insyirah: 6';
    }
  }
};






// ============================================
// MENU HOME
// ============================================
var Menu = {
  items: [
    { icon:'&#128214;', label:"Al-Qur'an",    page:'quran' },
    { icon:'&#127774;', label:'Dzikir Pagi',  page:'dzikir-pagi' },
    { icon:'&#127762;', label:'Dzikir Petang',page:'dzikir-petang' },
    { icon:'&#128591;', label:'Doa Harian',   page:'doa' },
    { icon:'&#10024;',  label:'Asmaul Husna', page:'asmaul' },
    { icon:'&#128336;', label:'Bacaan Shalat',page:'shalat' },
    { icon:'&#128203;', label:'Artikel',      page:'artikel' },
    { icon:'&#128220;', label:'Tentang',      page:'tentang' }
  ],

  render: function() {
    var grid = DOM.el('menu-grid');
    if (!grid) return;
    var frag = DOM.frag(this.items, function(m) {
      var btn = document.createElement('button');
      btn.className = 'menu-item';
      btn.innerHTML = '<div class="m-icon">' + m.icon + '</div><div class="m-label">' + m.label + '</div>';
      btn.onclick = function(){ Router.go(m.page); };
      return btn;
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }
};


// ============================================
// AL-QURAN
// ============================================
var Quran = (function(){
  var _all = [];
  var _currentSurah = null;   // simpan detail surah
  var _currentTafsir = null;  // simpan tafsir surat
  var _audio = new Audio();
  var _bookmarks = JSON.parse(localStorage.getItem('ayahBookmarks') || '[]');

  function loadList() {
    DOM.loading('surah-list');
    apiFetch('https://equran.id/api/v2/surat',
      function(d) {
        if (!d.data) return;
        _all = d.data;
        renderList(_all);
      },
      function(){ DOM.error('surah-list', 'Quran.loadList'); }
    );
  }

  function renderList(list) {
    var container = DOM.el('surah-list');
    if (!container) return;
    var frag = DOM.frag(list, function(s) {
      var div = document.createElement('div');
      div.className = 'surah-item';
      div.innerHTML =
        '<div class="surah-num">' + s.nomor + '</div>'
        + '<div class="surah-info">'
        +   '<div class="surah-nama">' + s.namaLatin + '</div>'
        +   '<div class="surah-meta">' + s.arti + ' &#183; ' + s.jumlahAyat + ' Ayat &#183; ' + s.tempatTurun + '</div>'
        + '</div>'
        + '<div class="surah-arab">' + s.nama + '</div>';
      div.onclick = function(){ loadSurah(s.nomor); };
      return div;
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  function cari(q) {
    var kw = q.toLowerCase();
    renderList(!kw ? _all : _all.filter(function(s){
      return s.namaLatin.toLowerCase().indexOf(kw) !== -1 || s.arti.toLowerCase().indexOf(kw) !== -1;
    }));
  }

  function loadSurah(nomor) {
    Router.go('surah');
    DOM.el('surah-title').textContent = 'Memuat...';
    DOM.loading('surah-detail');
    _currentSurah  = null;
    _currentTafsir = null;

    // Ambil surah (ayat + audio per ayat)
    apiFetch('https://equran.id/api/v2/surat/' + nomor,
      function(d) {
        if (!d.data) return;
        _currentSurah = d.data;
        renderSurah();
        // Setelah surah tampil, load tafsir di background
        ric(function(){ loadTafsir(nomor); });
      },
      function(){ DOM.error('surah-detail', 'Quran.loadSurah'); }
    );
  }

  function loadTafsir(nomor) {
    apiFetch('https://equran.id/api/v2/tafsir/' + nomor,
      function(d) {
        if (!d.data) return;
        _currentTafsir = d.data;
      },
      function(){ /* tafsir optional, tidak perlu error UI */ }
    );
  }

  function renderSurah() {
    var s = _currentSurah;
    if (!s) return;
    DOM.el('surah-title').textContent = s.namaLatin;

    var container = DOM.el('surah-detail');
    container.innerHTML =
      '<div class="surah-header">'
      + '<h2>' + s.namaLatin + ' (' + s.nama + ')</h2>'
      + '<p>' + s.arti + ' &#183; ' + s.jumlahAyat + ' Ayat &#183; ' + s.tempatTurun + '</p>'
      + '<audio controls src="' + s.audioFull['05'] + '" preload="none"></audio>'
      + '</div><div id="ayat-wrap"></div>';

    var wrap = DOM.el('ayat-wrap');
    var i = 0;
    function batch() {
      var frag = document.createDocumentFragment();
      var end  = Math.min(i + 15, s.ayat.length);
      while (i < end) {
        var a   = s.ayat[i];
        var key = s.nomor + ':' + a.nomorAyat; // contoh: 2:255
        var div = document.createElement('div');
        div.className = 'ayat-card' + (isBookmarked(key) ? ' bookmarked' : '');
        div.setAttribute('data-key', key);
        div.innerHTML =
          '<div class="ayat-num">' + a.nomorAyat + '</div>'
          + '<div class="ayat-arab">' + a.teksArab + '</div>'
          + '<div class="ayat-latin">' + a.teksLatin + '</div>'
          + '<div class="ayat-terjemah">' + a.teksIndonesia + '</div>'
          + '<div class="ayat-actions">'
          +   '<button onclick="Quran.playAyat('+s.nomor+','+a.nomorAyat+')">▶</button>'
          +   '<button onclick="Quran.toggleTafsir('+s.nomor+','+a.nomorAyat+')">Tafsir</button>'
          +   '<button onclick="Quran.copyAyat('+s.nomor+','+a.nomorAyat+')">Copy</button>'
          +   '<button onclick="Quran.shareAyat('+s.nomor+','+a.nomorAyat+')">Share</button>'
          +   '<button onclick="Quran.toggleBookmark('+s.nomor+','+a.nomorAyat+')">★</button>'
          + '</div>'
          + '<div class="ayat-tafsir" id="taf-'+s.nomor+'-'+a.nomorAyat+'" style="display:none"></div>';
        frag.appendChild(div);
        i++;
      }
      wrap.appendChild(frag);
      if (i < s.ayat.length) ric(batch);
    }
    ric(batch);
  }

  // ========== AUDIO PER AYAT ==========
  function playAyat(surahNo, ayatNo) {
    if (!_currentSurah || _currentSurah.nomor !== surahNo) return;
    var a = _currentSurah.ayat.find(function(x){ return x.nomorAyat === ayatNo; });
    if (!a || !a.audio) return;
    var src = a.audio['05'] || a.audio['01'] || '';  // pilih qari default [web:67][web:71]
    if (!src) return;
    try { _audio.pause(); } catch(e){}
    _audio.src = src;
    _audio.play();
  }

  // ========== TAFSIR PER AYAT ==========
  function toggleTafsir(surahNo, ayatNo) {
    var box = DOM.el('taf-'+surahNo+'-'+ayatNo);
    if (!box) return;
    if (!_currentTafsir || !_currentTafsir.ayat) {
      // Kalau tafsir belum selesai di-load, coba load sekarang
      loadTafsir(surahNo);
      return;
    }
    var t = _currentTafsir.ayat.find(function(x){ return x.nomorAyat === ayatNo; });
    if (!t) return;
    if (box.style.display === 'none') {
      box.style.display = 'block';
      box.innerHTML = t.teks || t.tafsir || '';
    } else {
      box.style.display = 'none';
    }
  }

  // ========== COPY ==========
  function copyAyat(surahNo, ayatNo) {
    if (!_currentSurah || _currentSurah.nomor !== surahNo) return;
    var a = _currentSurah.ayat.find(function(x){ return x.nomorAyat === ayatNo; });
    if (!a) return;
    var text = a.teksArab + '\n\n' + a.teksLatin + '\n\n' + a.teksIndonesia
      + '\n\n(Surah '+_currentSurah.namaLatin+' ['+surahNo+':'+ayatNo+'])';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ========== SHARE ==========
  function shareAyat(surahNo, ayatNo) {
    if (!_currentSurah || _currentSurah.nomor !== surahNo) return;
    var a = _currentSurah.ayat.find(function(x){ return x.nomorAyat === ayatNo; });
    if (!a) return;
    var text = a.teksArab + '\n\n' + a.teksIndonesia
      + '\n(Surah '+_currentSurah.namaLatin+' ['+surahNo+':'+ayatNo+'])';
    var url  = location.origin + '/#quran:' + surahNo + ':' + ayatNo;
    if (navigator.share) {
      navigator.share({ text: text, url: url });
    } else {
      // fallback: copy text + url
      copyAyat(surahNo, ayatNo);
      alert('Teks ayat sudah disalin. Bagikan manual di aplikasi lain.');
    }
  }

  // ========== BOOKMARK ==========
  function isBookmarked(key) {
    return _bookmarks.indexOf(key) !== -1;
  }

  function toggleBookmark(surahNo, ayatNo) {
    var key = surahNo + ':' + ayatNo;
    var idx = _bookmarks.indexOf(key);
    if (idx === -1) _bookmarks.push(key);
    else _bookmarks.splice(idx, 1);
    localStorage.setItem('ayahBookmarks', JSON.stringify(_bookmarks));

    var card = document.querySelector('.ayat-card[data-key="'+key+'"]');
    if (card) {
      if (idx === -1) card.classList.add('bookmarked');
      else card.classList.remove('bookmarked');
    }
  }

  return {
    loadList: loadList,
    cari:     cari,
    loadSurah: loadSurah,
    playAyat: playAyat,
    toggleTafsir: toggleTafsir,
    copyAyat: copyAyat,
    shareAyat: shareAyat,
    toggleBookmark: toggleBookmark
  };
})();



// ============================================
// DZIKIR / DOA / SHALAT
// ============================================
var Dzikir = (function(){
  var _counters = {};

  var API_MAP = {
    pagi:   'https://api.myquran.com/v2/doa/sumber/pagi',
    petang: 'https://api.myquran.com/v2/doa/sumber/petang',
    doa:    'https://api.myquran.com/v2/doa/sumber/pilihan',
    shalat: 'https://api.myquran.com/v2/doa/sumber/shalat'
  };

  function load(jenis, containerId) {
    DOM.loading(containerId);
    apiFetch(API_MAP[jenis],
      function(d) {
        if (!d.data) { DOM.error(containerId, function(){}); return; }
        render(d.data, containerId, jenis);
      },
      function(){ DOM.error(containerId, 'Dzikir.load("'+jenis+'","'+containerId+'")'); }
    );
  }

  function render(data, containerId, prefix) {
    var container = DOM.el(containerId);
    if (!container) return;
    var frag = DOM.frag(data, function(item, i) {
      var id  = prefix + '_' + i;
      _counters[id] = 0;
      var div = document.createElement('div');
      div.className = 'dzikir-card';
      div.innerHTML =
        (item.arab ? '<div class="dzikir-arab">' + item.arab + '</div>' : '')
        + (item.latin ? '<div class="dzikir-latin">' + item.latin + '</div>' : '')
        + (item.indo||item.terjemah ? '<div class="dzikir-terjemah">' + (item.indo||item.terjemah) + '</div>' : '')
        + (item.fadhilah ? '<div class="dzikir-fadhilah">&#128161; ' + item.fadhilah + '</div>' : '')
        + '<div class="dzikir-footer">'
        +   '<span class="dzikir-judul">' + (item.judul||'Dzikir') + '</span>'
        +   '<button class="counter-btn" id="btn-' + id + '" onclick="Dzikir.hitung(\'' + id + '\')">'
        +     '<span class="counter-num" id="cnt-' + id + '">0</span> x'
        +   '</button>'
        + '</div>';
      return div;
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  function hitung(id) {
    _counters[id] = (_counters[id] || 0) + 1;
    var el = DOM.el('cnt-' + id);
    if (el) el.textContent = _counters[id];
    if (navigator.vibrate) navigator.vibrate(20);
  }

  return { load: load, hitung: hitung };
})();


// ============================================
// ASMAUL HUSNA
// ============================================
var Asmaul = {
  load: function() {
    DOM.loading('list-asmaul');
    apiFetch('https://api.myquran.com/v2/husna/all',
      function(d) {
        if (!d.data) return;
        var container = DOM.el('list-asmaul');
        if (!container) return;
        var frag = DOM.frag(d.data, function(a) {
          var div = document.createElement('div');
          div.className = 'asma-card';
          div.innerHTML =
            '<div class="asma-num">' + a.nomor + '</div>'
            + '<div class="asma-arab">' + a.arab + '</div>'
            + '<div class="asma-latin">' + a.latin + '</div>'
            + '<div class="asma-arti">' + a.arti + '</div>';
          return div;
        });
        container.innerHTML = '';
        container.appendChild(frag);
      },
      function(){ DOM.error('list-asmaul', 'Asmaul.load'); }
    );
  }
};


// ============================================
// ARTIKEL
// ============================================
var Artikel = (function(){
  var _all = [];

  function parseEntry(e) {
    var url = ''; (e.link||[]).forEach(function(l){ if(l.rel==='alternate') url=l.href; });
    var thumb = e['media$thumbnail'] ? e['media$thumbnail'].url.replace('/s72-c/','/s400-c/') : '';
    return {
      id:     e.id ? e.id.$t : '',
      title:  e.title.$t,
      url:    url,
      thumb:  thumb,
      label:  (e.category&&e.category[0]) ? e.category[0].term : 'Artikel',
      date:   e.published ? e.published.$t.substring(0,10) : '',
      author: e.author ? e.author[0].name.$t : '',
      content: e.content ? e.content.$t : (e.summary ? e.summary.$t : '')
    };
  }

  function load() {
    DOM.loading('post-list');
    apiFetch('/feeds/posts/default?alt=json&max-results=20',
      function(d) {
        if (!d.feed) return;
        _all = (d.feed.entry||[]).map(parseEntry);
        render(_all, 'post-list');
      },
      function(){ DOM.error('post-list', 'Artikel.load'); }
    );
  }

  function render(posts, containerId) {
    var container = DOM.el(containerId);
    if (!container) return;
    if (!posts.length) { DOM.error(containerId, function(){}); return; }
    var frag = DOM.frag(posts, function(p) {
      var div = document.createElement('div');
      div.className = 'post-card';
      div.innerHTML =
        '<div class="p-thumb">'
        + (p.thumb ? '<img src="'+p.thumb+'" loading="lazy" decoding="async" alt=""/>' : '')
        + '</div>'
        + '<div class="p-info">'
        +   '<div class="p-tag">'+p.label+'</div>'
        +   '<h3>'+p.title+'</h3>'
        +   '<div class="p-meta">'+p.date+' &#183; '+p.author+'</div>'
        + '</div>';
      div.onclick = function(){
        sessionStorage.setItem('currentPost', JSON.stringify(p));
        PostReader.open(p);
      };
      return div;
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  function loadHome() {
    apiFetch('/feeds/posts/default?alt=json&max-results=5',
      function(d) {
        if (!d.feed) return;
        render((d.feed.entry||[]).map(parseEntry), 'post-home');
      },
      function(){ DOM.error('post-home', 'Artikel.loadHome'); }
    );
  }

  function filter(btn, cat) {
    document.querySelectorAll('#artikel-tabs .tab-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    var filtered = cat === 'semua' ? _all : _all.filter(function(p){
      return p.label.toLowerCase().indexOf(cat) !== -1;
    });
    render(filtered, 'post-list');
  }

  return { load: load, loadHome: loadHome, filter: filter, parseEntry: parseEntry };
})();


// ============================================
// POST READER
// ============================================
var PostReader = (function(){
  var _currentUrl = '';

  function open(post) {
    _currentUrl = post.url;
    Router.go('post');
    DOM.el('post-header-title').textContent = post.title || 'Artikel';
    DOM.loading('post-reader');

    // Coba fetch konten lengkap via Blogger post feed
    var pathname = '';
    try { pathname = new URL(post.url).pathname; } catch(e) { pathname = post.url; }
    var feedUrl = pathname.replace(/\.html$/, '') + '?alt=json';

    apiFetch(feedUrl,
      function(d) {
        if (d && d.entry) { renderPost(d.entry, post.url); return; }
        tryFallback(post);
      },
      function(){ tryFallback(post); }
    );
  }

  function load(postUrl) {
    _currentUrl = postUrl;
    Router.go('post');
    DOM.loading('post-reader');
    DOM.el('post-header-title').textContent = 'Memuat...';
    sessionStorage.removeItem('pendingPost');

    var pathname = '';
    try { pathname = new URL(postUrl).pathname; } catch(e) { pathname = postUrl; }
    var feedUrl = pathname.replace(/\.html$/, '') + '?alt=json';

    apiFetch(feedUrl,
      function(d) {
        if (d && d.entry) { renderPost(d.entry, postUrl); return; }
        var slug = postUrl.split('/').pop().replace('.html','');
        apiFetch('/feeds/posts/default?alt=json&max-results=1&q=' + encodeURIComponent(slug),
          function(d2) {
            if (d2&&d2.feed&&d2.feed.entry&&d2.feed.entry.length) { renderPost(d2.feed.entry[0], postUrl); }
            else { DOM.error('post-reader', 'PostReader.retry'); }
          },
          function(){ DOM.error('post-reader', 'PostReader.retry'); }
        );
      },
      function(){
        // Fallback: cached post
        var cached = sessionStorage.getItem('currentPost');
        if (cached) { try { renderPost(null, postUrl, JSON.parse(cached)); } catch(e){} }
        else { DOM.error('post-reader', 'PostReader.retry'); }
      }
    );
  }

  function tryFallback(post) {
    var postId = post.id ? post.id.split('post-')[1] : '';
    if (postId) {
      apiFetch('/feeds/posts/default/' + postId + '?alt=json',
        function(d) {
          if (d && d.entry) renderPost(d.entry, post.url);
          else renderCached(post);
        },
        function(){ renderCached(post); }
      );
    } else {
      renderCached(post);
    }
  }

  function renderCached(post) {
    renderPost(null, post.url, post);
  }

  function renderPost(entry, fallbackUrl, cached) {
    var p = cached || {};
    if (entry) {
      var url = fallbackUrl;
      (entry.link||[]).forEach(function(l){ if(l.rel==='alternate') url=l.href; });
      p = {
        title:   entry.title ? entry.title.$t : 'Artikel',
        url:     url,
        thumb:   entry['media$thumbnail'] ? entry['media$thumbnail'].url.replace('/s72-c/','/s1200/') : '',
        label:   (entry.category&&entry.category[0]) ? entry.category[0].term : 'Artikel',
        date:    entry.published ? entry.published.$t.substring(0,10) : '',
        author:  entry.author ? entry.author[0].name.$t : '',
        content: entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '<p>Konten tidak tersedia.</p>')
      };
    }

    _currentUrl = p.url || fallbackUrl;
    DOM.el('post-header-title').textContent = p.title || 'Artikel';
    document.title = (p.title || 'Artikel') + ' | ' + (document.querySelector('title')?.textContent || '');

    var container = DOM.el('post-reader');
    container.innerHTML =
      (p.thumb ? '<img class="artikel-hero" src="'+p.thumb+'" loading="lazy" alt=""/>' : '')
      + '<div class="artikel-body">'
      +   '<div class="artikel-label">' + (p.label||'Artikel') + '</div>'
      +   '<div class="artikel-judul">' + (p.title||'') + '</div>'
      +   '<div class="artikel-meta">'
      +     '<span>&#128100; ' + (p.author||'') + '</span>'
      +     '<span>&#128197; ' + (p.date||'') + '</span>'
      +   '</div>'
      +   '<div class="artikel-content">' + (p.content||'<p>Konten tidak tersedia.</p>') + '</div>'
      + '</div>'
      + '<button class="buka-web-btn" onclick="PostReader.bukaWeb()">&#127760; Buka di Browser</button>';
  }

  function retry() { load(_currentUrl); }

  function bukaWeb() {
    if (_currentUrl) window.open(_currentUrl, '_blank');
  }

  return { open: open, load: load, bukaWeb: bukaWeb, retry: retry };
})();


// ============================================
// INIT
// ============================================
window.addEventListener('load', function() {
  // Hapus skeleton
  var sk = document.getElementById('app-skeleton');
  if (sk) sk.remove();

  // Render menu
  Menu.render();

  // Tampilkan home
  document.getElementById('page-home').style.display = 'block';

  // Jam
  Jam.start();

  // Load prioritas tinggi
  Nasihat.load();

  // Load idle
  ric(function(){ Shalat.load(); });
  ric(function(){ Artikel.loadHome(); });

  // Init router (cek hash & pending post)
  Router.init();
});
