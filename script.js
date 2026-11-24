/* Body Scent — shared script
   product.html : #filter-bar, #product-list
   order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   admin.html   : #ordersTable tbody
*/
(function () {
  'use strict';

  var ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyGM9G-LDRfoaM4gklw-YWBMyHyCnCmfgVRD9Ej2l1VBJ6p2pgXxrRg929Y4muzEoEu/exec';
  var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwO029nQfD0xtfBWoKUuNMp4QWtBX1W7ZVpbG7bhV71HqA2Pdt8I7dQ2mtWB-p3Lx8afxj5dzrtCWJ/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'peach', label: 'Peach' }
  ];

  /* ---------- Helpers ---------- */

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function isValidMood(key) {
    return MOODS.some(function (m) { return m.key === key; });
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  function formatPrice(value) {
    var n = Number(value);
    return isFinite(n) && String(value).trim() !== '' ? n.toLocaleString('th-TH') : String(value);
  }

  /* ---------- Page: product.html ---------- */

  function initProducts() {
    var list = document.getElementById('product-list');
    var bar = document.getElementById('filter-bar');
    var products = [];
    var current = 'all';

    var requested = new URLSearchParams(window.location.search).get('mood');
    if (requested && isValidMood(requested.toLowerCase())) {
      current = requested.toLowerCase();
    }

    function showMessage(text) {
      list.textContent = '';
      var msg = el('p', 'text-center', text);
      msg.style.gridColumn = '1 / -1';
      msg.style.margin = '0 auto';
      list.appendChild(msg);
    }

    function updateUrl() {
      try {
        var url = new URL(window.location.href);
        if (current === 'all') {
          url.searchParams.delete('mood');
        } else {
          url.searchParams.set('mood', current);
        }
        window.history.replaceState(null, '', url);
      } catch (err) {
        /* ignore (e.g. file:// restrictions) */
      }
    }

    function renderBar() {
      if (!bar) return;
      bar.textContent = '';
      MOODS.forEach(function (m) {
        var active = m.key === current;
        var btn = el('button', 'chip' + (active ? ' is-active' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (m.key !== 'all') {
          btn.appendChild(el('span', 'mood-dot mood-dot--' + m.key));
        }
        btn.appendChild(document.createTextNode(m.label));
        btn.addEventListener('click', function () {
          current = m.key;
          updateUrl();
          renderBar();
          renderList();
        });
        bar.appendChild(btn);
      });
    }

    function buildCard(p) {
      var card = el('article', 'product-card');
      card.setAttribute('data-mood', p.mood);

      var img = el('img', 'product-card__image');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      card.appendChild(img);

      var meta = el('p', 'product-card__meta');
      meta.appendChild(el('span', 'mood-dot'));
      meta.appendChild(document.createTextNode('ขนาด ' + p.size));
      card.appendChild(meta);

      card.appendChild(el('h3', 'product-card__title', p.name));
      card.appendChild(el('span', 'card-rule'));
      card.appendChild(el('p', 'product-card__price', formatPrice(p.price) + ' บาท'));

      var order = el('a', 'btn btn--accent', 'สั่งซื้อ');
      order.href = 'order.html?item=' + encodeURIComponent(p.name) +
                   '&price=' + encodeURIComponent(p.price);
      card.appendChild(order);

      return card;
    }

    function renderList() {
      var shown = products.filter(function (p) {
        return current === 'all' || p.mood === current;
      });
      if (!shown.length) {
        showMessage('ยังไม่มีสินค้าในหมวด ' + moodLabel(current) + ' ขณะนี้');
        return;
      }
      list.textContent = '';
      shown.forEach(function (p) { list.appendChild(buildCard(p)); });
    }

    renderBar();
    showMessage('กำลังโหลดสินค้า...');

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        renderList();
      })
      .catch(function (err) {
        console.error(err);
        showMessage('ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- Page: order.html ---------- */

  function initOrder() {
    var form = document.getElementById('orderForm');
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');

    // Auto-fill both fields as soon as the page loads
    var itemsField = document.getElementById('items');
    var totalField = document.getElementById('total');
    if (itemsField && item) itemsField.value = item;
    if (totalField && price) totalField.value = price;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitOrder(form);
    });
  }

  function submitOrder(form) {
    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    })
    .finally(() => {
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  /* ---------- Page: admin.html ---------- */

  // Minimal CSV parser: quoted fields, escaped quotes (""), commas and
  // line breaks inside quotes, CRLF / LF line endings.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    var COLS = 6;

    function showRow(text) {
      tbody.textContent = '';
      var tr = document.createElement('tr');
      var td = el('td', 'text-center', text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showRow('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ''; });
        });

        // Skip a header row if present (a data row starts with a date, which has digits)
        if (rows.length && !/\d/.test(rows[0][0] || '')) rows.shift();

        // Orders are appended in time order, so reverse = newest first
        rows.reverse();

        if (!rows.length) {
          showRow('ยังไม่มีคำสั่งซื้อ');
          return;
        }

        tbody.textContent = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var i = 0; i < COLS; i++) {
            var value = r[i] !== undefined ? r[i] : '';
            if (i === 4) value = formatPrice(value);
            tr.appendChild(el('td', '', value));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showRow('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- Init (runs only the parts the current page has) ---------- */

  onReady(function () {
    if (document.getElementById('product-list')) initProducts();
    if (document.getElementById('orderForm')) initOrder();
    if (document.querySelector('#ordersTable tbody')) initAdmin();
  });
})();
