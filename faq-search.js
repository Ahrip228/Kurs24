/**
 * Kursov24 FAQ Search Module
 * Provides real-time search and filtering of FAQ questions with highlighting.
 *
 * Works with the existing faq.html page structure:
 *   .faq-section > .wrap > .faq-list > .faq-item > .faq-q (question) + .faq-a > .faq-a-inner (answer)
 *
 * Usage: include this script after the FAQ markup or at the end of <body>.
 *   <script src="faq-search.js"></script>
 */
(function () {
    'use strict';

    // ── Configuration ───────────────────────────────────────────────────
    var HIGHLIGHT_CLASS = 'faq-highlight';
    var HIGHLIGHT_COLOR = '#E8660A';           // matches --orange
    var MIN_SEARCH_LENGTH = 2;
    var DEBOUNCE_DELAY = 200;                  // ms

    // ── 1. Inject styles ────────────────────────────────────────────────
    var css = [
        '.faq-search-wrap{margin-bottom:24px;max-width:800px;margin-left:auto;margin-right:auto}',
        '.faq-search-inner{position:relative;display:flex;align-items:center}',
        '.faq-search-input{width:100%;padding:14px 44px 14px 44px;border:1px solid #E8E6E1;border-radius:12px;',
        '  font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;color:#1A1A1A;',
        '  background:#FFFFFF;outline:none;transition:border-color .25s,box-shadow .25s}',
        '.faq-search-input::placeholder{color:#8E8E93}',
        '.faq-search-input:focus{border-color:' + HIGHLIGHT_COLOR + ';box-shadow:0 0 0 3px rgba(232,102,10,.12)}',
        '.faq-search-icon{position:absolute;left:14px;width:18px;height:18px;color:#8E8E93;pointer-events:none}',
        '.faq-search-clear{position:absolute;right:14px;background:none;border:none;color:#8E8E93;cursor:pointer;',
        '  font-size:16px;line-height:1;padding:4px;border-radius:4px;transition:color .2s}',
        '.faq-search-clear:hover{color:#1A1A1A}',
        '.' + HIGHLIGHT_CLASS + '{background:rgba(232,102,10,.15);color:' + HIGHLIGHT_COLOR + ';',
        '  border-radius:2px;padding:0 1px;font-weight:inherit}',
        '.faq-search-count{font-size:13px;color:#8E8E93;margin-top:8px}',
        '.faq-item-hidden{display:none!important}',
        '.faq-no-results{text-align:center;padding:32px;color:#8E8E93;font-size:15px;line-height:1.6}'
    ].join('\n');

    var styleEl = document.createElement('style');
    styleEl.setAttribute('data-faq-search', '');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ── 2. Build the search bar markup ──────────────────────────────────
    var searchSVG =
        '<svg class="faq-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    var wrapEl = document.createElement('div');
    wrapEl.className = 'faq-search-wrap';

    var innerEl = document.createElement('div');
    innerEl.className = 'faq-search-inner';
    innerEl.innerHTML = searchSVG;

    var inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'faq-search-input';
    inputEl.setAttribute('placeholder', '\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u043C\u2026'); // "Поиск по вопросам..."
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.setAttribute('spellcheck', 'false');

    var clearBtn = document.createElement('button');
    clearBtn.className = 'faq-search-clear';
    clearBtn.type = 'button';
    clearBtn.textContent = '\u2715'; // ✕
    clearBtn.style.display = 'none';
    clearBtn.setAttribute('aria-label', '\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A'); // "Очистить поиск"

    innerEl.appendChild(inputEl);
    innerEl.appendChild(clearBtn);
    wrapEl.appendChild(innerEl);

    var countEl = document.createElement('div');
    countEl.className = 'faq-search-count';
    countEl.style.display = 'none';
    var countSpan = document.createElement('span');
    countSpan.textContent = '0';
    countEl.appendChild(document.createTextNode('\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ')); // "Найдено: "
    countEl.appendChild(countSpan);
    wrapEl.appendChild(countEl);

    // ── 3. Locate FAQ elements & insert search bar ──────────────────────
    var faqList = document.querySelector('.faq-list');
    if (!faqList) {
        // Graceful exit: the page has no FAQ list
        return;
    }

    // Insert the search bar immediately before .faq-list
    faqList.parentNode.insertBefore(wrapEl, faqList);

    // Collect FAQ items
    var items = faqList.querySelectorAll('.faq-item');
    if (!items.length) {
        return; // nothing to search
    }

    // Store original text for each item so we can always compare against
    // clean content even after the DOM has been modified with highlights.
    var itemData = [];
    for (var i = 0; i < items.length; i++) {
        var qBtn = items[i].querySelector('.faq-q');
        var aDiv = items[i].querySelector('.faq-a-inner');
        itemData.push({
            el: items[i],
            qEl: qBtn,
            aEl: aDiv,
            // Collect textContent only from text nodes inside .faq-q
            // (skip the SVG chevron text which is empty anyway).
            qText: getTextOnly(qBtn),
            aText: aDiv ? aDiv.textContent : ''
        });
    }

    // Reference for the "no results" placeholder
    var noResultsEl = null;

    // ── 4. Utility: debounce ────────────────────────────────────────────
    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var ctx = this;
            var args = arguments;
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                timer = null;
                fn.apply(ctx, args);
            }, delay);
        };
    }

    // ── 5. Utility: extract text from an element, skipping SVGs ────────
    function getTextOnly(el) {
        if (!el) return '';
        var text = '';
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
            // Skip text nodes that live inside <svg> elements
            if (!isInsideSVG(node)) {
                text += node.nodeValue;
            }
        }
        return text;
    }

    function isInsideSVG(node) {
        var parent = node.parentNode;
        while (parent && parent !== document) {
            if (parent.nodeName.toLowerCase() === 'svg') {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    }

    // ── 6. Escape regex special characters ──────────────────────────────
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ── 7. Highlight matching text inside an element ────────────────────
    //   Walks text nodes (skipping SVG internals), wraps matching
    //   substrings in <mark class="faq-highlight">.
    function highlightIn(el, query) {
        if (!el || !query) return;

        var escapedQuery = escapeRegex(query);
        var regex = new RegExp('(' + escapedQuery + ')', 'gi');

        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode())) {
            if (!isInsideSVG(node)) {
                textNodes.push(node);
            }
        }

        for (var t = 0; t < textNodes.length; t++) {
            var tn = textNodes[t];
            var val = tn.nodeValue;
            if (!regex.test(val)) {
                continue;
            }
            regex.lastIndex = 0; // reset after .test()

            // Build a document fragment with highlighted spans
            var frag = document.createDocumentFragment();
            var lastIdx = 0;
            var match;
            while ((match = regex.exec(val)) !== null) {
                // Text before the match
                if (match.index > lastIdx) {
                    frag.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
                }
                // The matched portion wrapped in <mark>
                var mark = document.createElement('mark');
                mark.className = HIGHLIGHT_CLASS;
                mark.textContent = match[1];
                frag.appendChild(mark);
                lastIdx = regex.lastIndex;
            }
            // Remaining text after last match
            if (lastIdx < val.length) {
                frag.appendChild(document.createTextNode(val.substring(lastIdx)));
            }

            tn.parentNode.replaceChild(frag, tn);
        }
    }

    // ── 8. Remove all highlights and normalise text nodes ───────────────
    function removeHighlights() {
        var marks = faqList.querySelectorAll('.' + HIGHLIGHT_CLASS);
        for (var i = 0; i < marks.length; i++) {
            var mark = marks[i];
            var parent = mark.parentNode;
            // Replace the <mark> with its text content
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            // Merge adjacent text nodes
            parent.normalize();
        }
    }

    // ── 9. Remove "no results" message if present ───────────────────────
    function removeNoResults() {
        if (noResultsEl && noResultsEl.parentNode) {
            noResultsEl.parentNode.removeChild(noResultsEl);
            noResultsEl = null;
        }
    }

    // ── 10. Show all FAQ items ──────────────────────────────────────────
    function showAllItems() {
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove('faq-item-hidden');
        }
    }

    // ── 11. Clear search (reset everything) ─────────────────────────────
    function clearSearch() {
        inputEl.value = '';
        clearBtn.style.display = 'none';
        countEl.style.display = 'none';
        removeHighlights();
        showAllItems();
        removeNoResults();
    }

    // ── 12. Main search function ────────────────────────────────────────
    function performSearch() {
        var raw = inputEl.value;
        var query = raw.trim().toLowerCase();

        // Toggle clear button visibility
        clearBtn.style.display = raw.length > 0 ? '' : 'none';

        // If query is too short, reset view
        if (query.length < MIN_SEARCH_LENGTH) {
            removeHighlights();
            showAllItems();
            countEl.style.display = 'none';
            removeNoResults();
            return;
        }

        removeHighlights();
        removeNoResults();

        var matchCount = 0;

        for (var i = 0; i < itemData.length; i++) {
            var d = itemData[i];
            var qMatch = d.qText.toLowerCase().indexOf(query) !== -1;
            var aMatch = d.aText.toLowerCase().indexOf(query) !== -1;

            if (qMatch || aMatch) {
                d.el.classList.remove('faq-item-hidden');
                matchCount++;
                // Apply highlights
                if (qMatch) {
                    highlightIn(d.qEl, query);
                }
                if (aMatch) {
                    highlightIn(d.aEl, query);
                }
            } else {
                d.el.classList.add('faq-item-hidden');
            }
        }

        // Update counter
        countSpan.textContent = String(matchCount);
        countEl.style.display = '';

        // "No results" message
        if (matchCount === 0) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'faq-no-results';
            noResultsEl.textContent = '\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 \u00AB' + raw.trim() + '\u00BB'; // "Ничего не найдено по запросу «...»"
            faqList.appendChild(noResultsEl);
        }
    }

    // ── 13. Event listeners ─────────────────────────────────────────────
    var debouncedSearch = debounce(performSearch, DEBOUNCE_DELAY);

    inputEl.addEventListener('input', debouncedSearch);
    inputEl.addEventListener('keyup', function (e) {
        // Immediate response on Escape
        if (e.key === 'Escape' || e.keyCode === 27) {
            clearSearch();
            inputEl.blur();
        }
    });

    clearBtn.addEventListener('click', function () {
        clearSearch();
        inputEl.focus();
    });
})();
