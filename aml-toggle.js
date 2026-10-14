/**
 * Kursov24 AML Check Module
 * Handles AML check form interactions, validation, and network toggling.
 *
 * Works with the DOM structure in aml-check.html:
 *   - Tab buttons:    .check-tab[data-tab="hash"|"address"]
 *   - Input field:    #checkInput
 *   - Input label:    #inputLabel
 *   - Network grid:   #networkGrid > .network-btn[data-network]
 *   - Submit button:  #btnCheck
 */
(function () {
    'use strict';

    // =========================================================================
    // 1. Network configuration
    // =========================================================================

    /**
     * Each key corresponds to a data-network attribute value on the network
     * buttons in the HTML. Every entry carries:
     *   - name       : human-readable label (used in error messages)
     *   - pattern    : RegExp that validates a wallet address
     *   - hashPattern: RegExp that validates a transaction hash
     */
    var NETWORKS = {
        btc: {
            name: 'Bitcoin',
            pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{25,90}$/i,
            hashPattern: /^[a-f0-9]{64}$/i
        },
        eth: {
            name: 'Ethereum',
            pattern: /^0x[a-fA-F0-9]{40}$/,
            hashPattern: /^0x[a-f0-9]{64}$/i
        },
        'usdt-trc20': {
            name: 'USDT TRC-20',
            pattern: /^T[a-zA-Z0-9]{33}$/,
            hashPattern: /^[a-f0-9]{64}$/i
        },
        'usdt-erc20': {
            name: 'USDT ERC-20',
            pattern: /^0x[a-fA-F0-9]{40}$/,
            hashPattern: /^0x[a-f0-9]{64}$/i
        },
        ltc: {
            name: 'Litecoin',
            pattern: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{25,90}$/i,
            hashPattern: /^[a-f0-9]{64}$/i
        },
        bnb: {
            name: 'BNB',
            pattern: /^0x[a-fA-F0-9]{40}$|^bnb1[a-z0-9]{38}$/i,
            hashPattern: /^[a-f0-9]{64}$/i
        }
    };

    // =========================================================================
    // 2. DOM element references
    // =========================================================================

    var tabButtons     = document.querySelectorAll('.check-tab');
    var inputEl        = document.getElementById('checkInput');
    var labelEl        = document.getElementById('inputLabel');
    var networkGrid    = document.getElementById('networkGrid');
    var networkButtons = networkGrid
        ? networkGrid.querySelectorAll('.network-btn')
        : [];
    var submitBtn      = document.getElementById('btnCheck');

    // Error message element (created dynamically so the HTML stays untouched)
    var errorEl = document.createElement('div');
    errorEl.className = 'check-input-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    errorEl.style.cssText =
        'font-size:12.5px;font-weight:600;color:#D32F2F;margin-top:6px;' +
        'min-height:18px;transition:opacity .2s;opacity:0;';

    // Insert the error element right after the input wrapper
    if (inputEl && inputEl.parentNode) {
        inputEl.parentNode.appendChild(errorEl);
    }

    // =========================================================================
    // 3. State management
    // =========================================================================

    /** @type {'hash'|'address'} */
    var currentMode = 'address';   // matches the initially-active tab

    /** @type {string} */
    var currentNetwork = 'btc';    // matches the initially-active network button

    // =========================================================================
    // 4. Tab toggle function
    // =========================================================================

    /**
     * Switches between "hash" and "address" mode.
     * Updates the input label, placeholder, clears any value, and refreshes
     * active-tab styling.
     *
     * @param {string} mode - Either 'hash' or 'address'.
     */
    function switchTab(mode) {
        if (mode !== 'hash' && mode !== 'address') return;
        currentMode = mode;

        // Update active tab styling
        tabButtons.forEach(function (tab) {
            if (tab.getAttribute('data-tab') === mode) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        // Update label and placeholder
        if (mode === 'hash') {
            labelEl.textContent = '\u0425\u0435\u0448 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438';          // "Хеш транзакции"
            inputEl.placeholder = '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0445\u0435\u0448 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438'; // "Введите хеш транзакции для проверки"
        } else {
            labelEl.textContent = '\u0410\u0434\u0440\u0435\u0441 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430';          // "Адрес кошелька"
            inputEl.placeholder = getPlaceholderForNetwork(currentNetwork);
        }

        // Clear input and error state
        inputEl.value = '';
        clearError();
        inputEl.focus();
    }

    // =========================================================================
    // 5. Network toggle function
    // =========================================================================

    /**
     * Returns an appropriate placeholder string for the given network and the
     * current mode.
     *
     * @param {string} networkKey - One of the NETWORKS keys.
     * @returns {string}
     */
    function getPlaceholderForNetwork(networkKey) {
        var net = NETWORKS[networkKey];
        if (!net) return '';

        if (currentMode === 'hash') {
            // "Введите хеш транзакции для проверки"
            return '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0445\u0435\u0448 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438';
        }

        // "Введите {network} адрес для проверки"
        return '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 ' + net.name + ' \u0430\u0434\u0440\u0435\u0441 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438';
    }

    /**
     * Switches the active network.
     * Updates network button styling and adjusts the input placeholder.
     *
     * @param {string} networkKey - One of the NETWORKS keys (e.g. 'btc', 'eth').
     */
    function switchNetwork(networkKey) {
        if (!NETWORKS[networkKey]) return;
        currentNetwork = networkKey;

        // Update active button styling
        networkButtons.forEach(function (btn) {
            if (btn.getAttribute('data-network') === networkKey) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });

        // Update placeholder to reflect the selected network
        inputEl.placeholder = getPlaceholderForNetwork(networkKey);

        // Re-validate if the user already has text in the input
        if (inputEl.value.trim().length > 0) {
            validateAndShowError();
        }
    }

    // =========================================================================
    // 6. Validation function
    // =========================================================================

    /**
     * Validates the current input value against the selected network and mode.
     *
     * @param {string} value - The raw input value to validate.
     * @returns {{ valid: boolean, message: string }}
     */
    function validate(value) {
        var trimmed = value.trim();
        var net = NETWORKS[currentNetwork];

        if (!net) {
            return { valid: false, message: '\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0441\u0435\u0442\u044C' }; // "Неизвестная сеть"
        }

        // Empty input
        if (trimmed.length === 0) {
            if (currentMode === 'hash') {
                // "Введите хеш транзакции"
                return { valid: false, message: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0445\u0435\u0448 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438' };
            }
            // "Введите адрес кошелька"
            return { valid: false, message: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430' };
        }

        if (currentMode === 'hash') {
            // Validate transaction hash
            if (net.hashPattern.test(trimmed)) {
                return { valid: true, message: '' };
            }
            // "Некорректный хеш транзакции для сети {network}"
            return {
                valid: false,
                message: '\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0445\u0435\u0448 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0438 \u0434\u043B\u044F \u0441\u0435\u0442\u0438 ' + net.name
            };
        }

        // Validate wallet address
        if (net.pattern.test(trimmed)) {
            return { valid: true, message: '' };
        }
        // "Некорректный адрес кошелька для сети {network}"
        return {
            valid: false,
            message: '\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430 \u0434\u043B\u044F \u0441\u0435\u0442\u0438 ' + net.name
        };
    }

    // =========================================================================
    // 7. Real-time validation on input
    // =========================================================================

    /**
     * Shows the error message element with the given text.
     *
     * @param {string} message - Error text to display.
     */
    function showError(message) {
        errorEl.textContent = message;
        errorEl.style.opacity = '1';
        inputEl.style.borderColor = '#D32F2F';
    }

    /**
     * Clears the error state and resets input border to default.
     */
    function clearError() {
        errorEl.textContent = '';
        errorEl.style.opacity = '0';
        inputEl.style.borderColor = '';
    }

    /**
     * Marks the input border as valid (green).
     */
    function showValid() {
        errorEl.textContent = '';
        errorEl.style.opacity = '0';
        inputEl.style.borderColor = '#2E7D32';
    }

    /**
     * Performs validation and updates the UI accordingly.
     * Called during real-time input and before submission.
     *
     * @returns {{ valid: boolean, message: string }}
     */
    function validateAndShowError() {
        var value = inputEl.value;
        var trimmed = value.trim();

        // If empty, reset to neutral state (no error, no green border)
        if (trimmed.length === 0) {
            clearError();
            return { valid: false, message: '' };
        }

        var result = validate(value);

        if (result.valid) {
            showValid();
        } else {
            showError(result.message);
        }

        return result;
    }

    // =========================================================================
    // 8. Form submission handler
    // =========================================================================

    /** Original button HTML so we can restore it after loading state */
    var originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';

    /**
     * Sets the submit button into a loading / spinner state and disables it.
     */
    function setLoadingState() {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ' +
            'style="animation:spin .8s linear infinite">' +
            '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83' +
            'M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>' +
            ' \u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u2026'; // "Проверяем..."

        // Inject the @keyframes once if not present
        if (!document.getElementById('aml-spin-style')) {
            var style = document.createElement('style');
            style.id = 'aml-spin-style';
            style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
    }

    /**
     * Restores the submit button to its default state.
     */
    function resetLoadingState() {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.innerHTML = originalBtnHTML;
    }

    /**
     * Inject the shake keyframes once (used on invalid submission).
     */
    function injectShakeStyle() {
        if (document.getElementById('aml-shake-style')) return;
        var style = document.createElement('style');
        style.id = 'aml-shake-style';
        style.textContent =
            '@keyframes shake{' +
            '0%,100%{transform:translateX(0)}' +
            '10%,30%,50%,70%,90%{transform:translateX(-4px)}' +
            '20%,40%,60%,80%{transform:translateX(4px)}' +
            '}';
        document.head.appendChild(style);
    }

    /**
     * Applies a brief shake animation to the input field to draw attention
     * to the error.
     */
    function shakeInput() {
        injectShakeStyle();
        inputEl.style.animation = 'none';
        // Force reflow so the animation restarts cleanly
        void inputEl.offsetWidth;
        inputEl.style.animation = 'shake 0.5s ease';
        // Clean up after the animation finishes
        setTimeout(function () {
            inputEl.style.animation = '';
        }, 550);
    }

    /**
     * Handles the "Check" button click or Enter key submission.
     */
    function handleSubmit() {
        // Prevent double-submit while loading
        if (submitBtn.disabled) return;

        var result = validate(inputEl.value);

        if (result.valid) {
            // Show loading state, then redirect after a short delay
            setLoadingState();

            // Build query parameters for the payment page
            var params = new URLSearchParams();
            params.set('mode', currentMode);
            params.set('network', currentNetwork);
            params.set('value', inputEl.value.trim());

            setTimeout(function () {
                window.location.href = 'aml-check-payment.html?' + params.toString();
            }, 800);
        } else {
            // Show error with shake animation
            showError(result.message);
            shakeInput();
            inputEl.focus();
        }
    }

    // =========================================================================
    // 9. Input formatting helpers
    // =========================================================================

    /**
     * Trims whitespace from the input value on blur.
     */
    function handleBlur() {
        inputEl.value = inputEl.value.trim();
        // Re-validate after trimming (only if non-empty)
        if (inputEl.value.length > 0) {
            validateAndShowError();
        } else {
            clearError();
        }
    }

    /**
     * Removes leading and trailing spaces from pasted content.
     *
     * @param {ClipboardEvent} e
     */
    function handlePaste(e) {
        // Let the browser insert the text first, then trim on next tick
        setTimeout(function () {
            inputEl.value = inputEl.value.trim();
            validateAndShowError();
        }, 0);
    }

    // =========================================================================
    // 10. Keyboard support
    // =========================================================================

    /**
     * Handles keydown events on the input field.
     * Enter key triggers form submission.
     *
     * @param {KeyboardEvent} e
     */
    function handleInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    }

    /**
     * Handles keydown events on network buttons so they can be activated
     * with Enter or Space (accessibility).
     *
     * @param {KeyboardEvent} e
     */
    function handleNetworkKeydown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            var networkKey = this.getAttribute('data-network');
            if (networkKey) {
                switchNetwork(networkKey);
            }
        }
    }

    // =========================================================================
    // Initialize: attach all event listeners
    // =========================================================================

    function init() {
        // Bail out gracefully if critical DOM elements are missing
        if (!inputEl || !labelEl || !submitBtn || !networkGrid) {
            // The module is likely loaded on a page without the AML form
            return;
        }

        // --- Tab buttons ---
        tabButtons.forEach(function (tab) {
            tab.setAttribute('role', 'tab');
            var isActive = tab.classList.contains('active');
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');

            tab.addEventListener('click', function () {
                var mode = tab.getAttribute('data-tab');
                switchTab(mode);
            });
        });

        // --- Network buttons ---
        networkButtons.forEach(function (btn) {
            btn.setAttribute('role', 'button');
            var isActive = btn.classList.contains('active');
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

            btn.addEventListener('click', function () {
                var networkKey = btn.getAttribute('data-network');
                if (networkKey) {
                    switchNetwork(networkKey);
                }
            });

            btn.addEventListener('keydown', handleNetworkKeydown);
        });

        // --- Real-time validation on input ---
        inputEl.addEventListener('input', function () {
            validateAndShowError();
        });

        // --- Submit button ---
        submitBtn.addEventListener('click', function (e) {
            e.preventDefault();
            handleSubmit();
        });

        // --- Input formatting ---
        inputEl.addEventListener('blur', handleBlur);
        inputEl.addEventListener('paste', handlePaste);

        // --- Keyboard support on input ---
        inputEl.addEventListener('keydown', handleInputKeydown);

        // --- Set initial placeholder based on default network ---
        inputEl.placeholder = getPlaceholderForNetwork(currentNetwork);
    }

    // Run initialisation once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
