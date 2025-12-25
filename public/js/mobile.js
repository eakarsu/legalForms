/**
 * Mobile JavaScript Utilities for LegalPracticeAI
 * Provides touch-friendly interactions, gestures, and mobile-specific features
 * Version: 1.0.0
 */

(function() {
    'use strict';

    // ===== Configuration =====
    const config = {
        touchThreshold: 10,
        swipeThreshold: 50,
        longPressDelay: 500,
        doubleTapDelay: 300,
        pullToRefreshThreshold: 80
    };

    // ===== Device Detection =====
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    // ===== Service Worker Registration =====
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    });
                    console.log('[Mobile] ServiceWorker registered:', registration.scope);

                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateNotification();
                            }
                        });
                    });
                } catch (error) {
                    console.log('[Mobile] ServiceWorker registration failed:', error);
                }
            });
        }
    }

    // ===== PWA Install Prompt =====
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    function showInstallButton() {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) {
            installBanner.style.display = 'block';
        }
    }

    function installPWA() {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('[Mobile] PWA installed');
                showToast('App installed successfully!', 'success');
            }
            deferredPrompt = null;
            hideInstallButton();
        });
    }

    function hideInstallButton() {
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) {
            installBanner.style.display = 'none';
        }
    }

    // Expose install function globally
    window.installPWA = installPWA;

    // ===== Toast Notifications =====
    function showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.mobile-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `mobile-toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="mobile-toast-action" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    // Expose globally
    window.showToast = showToast;

    // ===== Pull to Refresh =====
    function initPullToRefresh() {
        if (!hasTouch) return;

        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const indicator = createPullIndicator();

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].pageY;
                isPulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;

            currentY = e.touches[0].pageY;
            const pullDistance = currentY - startY;

            if (pullDistance > 0 && window.scrollY === 0) {
                indicator.style.transform = `translateY(${Math.min(pullDistance - 60, config.pullToRefreshThreshold)}px)`;
                indicator.style.opacity = Math.min(pullDistance / config.pullToRefreshThreshold, 1);

                if (pullDistance > config.pullToRefreshThreshold) {
                    indicator.classList.add('active');
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!isPulling) return;

            const pullDistance = currentY - startY;

            if (pullDistance > config.pullToRefreshThreshold && window.scrollY === 0) {
                // Trigger refresh
                indicator.classList.add('active');
                window.location.reload();
            } else {
                // Reset
                indicator.style.transform = 'translateY(-100%)';
                indicator.style.opacity = 0;
            }

            isPulling = false;
            currentY = 0;
        }, { passive: true });
    }

    function createPullIndicator() {
        let indicator = document.querySelector('.pull-to-refresh');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'pull-to-refresh';
            indicator.innerHTML = '<div class="spinner"></div>';
            document.body.prepend(indicator);
        }
        return indicator;
    }

    // ===== Swipe Gestures =====
    function initSwipeGestures() {
        if (!hasTouch) return;

        const swipeContainers = document.querySelectorAll('.swipe-container');

        swipeContainers.forEach(container => {
            let startX = 0;
            let currentX = 0;
            let startY = 0;
            const content = container.querySelector('.swipe-content');
            const actions = container.querySelector('.swipe-actions');

            if (!content || !actions) return;

            const actionsWidth = actions.offsetWidth;

            container.addEventListener('touchstart', (e) => {
                startX = e.touches[0].pageX;
                startY = e.touches[0].pageY;
                content.style.transition = 'none';
            }, { passive: true });

            container.addEventListener('touchmove', (e) => {
                currentX = e.touches[0].pageX;
                const diffX = startX - currentX;
                const diffY = Math.abs(e.touches[0].pageY - startY);

                // Only allow horizontal swipe
                if (diffY > Math.abs(diffX)) return;

                if (diffX > 0 && diffX <= actionsWidth) {
                    content.style.transform = `translateX(-${diffX}px)`;
                }
            }, { passive: true });

            container.addEventListener('touchend', () => {
                content.style.transition = 'transform 0.3s ease';
                const diffX = startX - currentX;

                if (diffX > config.swipeThreshold) {
                    // Show actions
                    content.style.transform = `translateX(-${actionsWidth}px)`;
                } else {
                    // Hide actions
                    content.style.transform = 'translateX(0)';
                }
            }, { passive: true });
        });
    }

    // ===== Bottom Navigation =====
    function initBottomNav() {
        const bottomNav = document.getElementById('mobileBottomNav');
        if (!bottomNav) return;

        // Hide on scroll down, show on scroll up
        let lastScrollY = window.scrollY;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    const scrollDiff = currentScrollY - lastScrollY;

                    if (scrollDiff > 10 && currentScrollY > 100) {
                        // Scrolling down
                        bottomNav.style.transform = 'translateY(100%)';
                    } else if (scrollDiff < -10 || currentScrollY < 100) {
                        // Scrolling up
                        bottomNav.style.transform = 'translateY(0)';
                    }

                    lastScrollY = currentScrollY;
                    ticking = false;
                });

                ticking = true;
            }
        }, { passive: true });

        // Add transition
        bottomNav.style.transition = 'transform 0.3s ease';
    }

    // ===== Mobile Form Enhancements =====
    function initMobileForms() {
        // Prevent zoom on input focus (iOS)
        if (isIOS) {
            const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input[type="tel"], textarea, select');
            inputs.forEach(input => {
                if (parseFloat(getComputedStyle(input).fontSize) < 16) {
                    input.style.fontSize = '16px';
                }
            });
        }

        // Auto-resize textareas
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        });

        // Enhance date/time inputs
        const dateInputs = document.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"]');
        dateInputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.showPicker?.();
            });
        });
    }

    // ===== Mobile Tables =====
    function initMobileTables() {
        if (window.innerWidth > 767) return;

        const tables = document.querySelectorAll('.table-responsive-cards');
        tables.forEach(table => {
            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());

            table.querySelectorAll('tbody td').forEach((td, index) => {
                const headerIndex = index % headers.length;
                td.setAttribute('data-label', headers[headerIndex] || '');
            });
        });
    }

    // ===== Haptic Feedback =====
    function vibrate(pattern = [10]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    // Add haptic feedback to buttons
    function initHapticFeedback() {
        if (!hasTouch || !('vibrate' in navigator)) return;

        document.addEventListener('click', (e) => {
            if (e.target.matches('button, .btn, [role="button"]')) {
                vibrate([10]);
            }
        });
    }

    // ===== Keyboard Handling =====
    function initKeyboardHandling() {
        const bottomNav = document.getElementById('mobileBottomNav');

        // Hide bottom nav when keyboard is open
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => {
                const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
                if (bottomNav) {
                    bottomNav.style.display = isKeyboardOpen ? 'none' : 'flex';
                }
            });
        }
    }

    // ===== Orientation Change =====
    function initOrientationHandler() {
        window.addEventListener('orientationchange', () => {
            // Small delay to allow browser to complete rotation
            setTimeout(() => {
                // Recalculate layouts
                initMobileTables();

                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('mobile:orientationchange', {
                    detail: { orientation: screen.orientation?.type || 'unknown' }
                }));
            }, 100);
        });
    }

    // ===== Network Status =====
    function initNetworkStatus() {
        function updateNetworkStatus() {
            if (!navigator.onLine) {
                showToast('You are offline. Some features may not be available.', 'warning', 5000);
                document.body.classList.add('offline');
            } else {
                document.body.classList.remove('offline');
            }
        }

        window.addEventListener('online', () => {
            showToast('You are back online!', 'success');
            document.body.classList.remove('offline');
        });

        window.addEventListener('offline', updateNetworkStatus);

        // Initial check
        updateNetworkStatus();
    }

    // ===== Update Notification =====
    function showUpdateNotification() {
        const toast = showToast('A new version is available!', 'info', 0);
        const actionBtn = document.createElement('button');
        actionBtn.className = 'mobile-toast-action';
        actionBtn.textContent = 'Update';
        actionBtn.onclick = () => {
            window.location.reload();
        };
        toast.appendChild(actionBtn);
    }

    // ===== iOS Standalone Mode Fixes =====
    function initIOSStandaloneFixes() {
        if (!isIOS || !isStandalone) return;

        // Fix for iOS standalone mode link handling
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && !link.target && link.hostname === window.location.hostname) {
                e.preventDefault();
                window.location.href = link.href;
            }
        });

        // Fix for status bar tap to scroll top
        document.body.addEventListener('touchstart', (e) => {
            if (e.touches[0].pageY < 20) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, { passive: true });
    }

    // ===== Lazy Loading Images =====
    function initLazyLoading() {
        if ('loading' in HTMLImageElement.prototype) {
            // Browser supports native lazy loading
            document.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
                img.loading = 'lazy';
            });
        } else {
            // Fallback to IntersectionObserver
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // ===== Back Button Handler (for modals/menus) =====
    function initBackButtonHandler() {
        window.addEventListener('popstate', (e) => {
            // Close any open modals
            const openModals = document.querySelectorAll('.modal.show');
            openModals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                    e.preventDefault();
                }
            });

            // Close mobile menu
            const mobileMenu = document.querySelector('.navbar-collapse.show');
            if (mobileMenu) {
                const toggler = document.querySelector('.navbar-toggler');
                if (toggler) {
                    toggler.click();
                    e.preventDefault();
                }
            }
        });
    }

    // ===== Initialize All =====
    function init() {
        console.log('[Mobile] Initializing mobile enhancements...');

        registerServiceWorker();

        if (hasTouch || isMobile) {
            initPullToRefresh();
            initSwipeGestures();
            initHapticFeedback();
            initKeyboardHandling();
        }

        initBottomNav();
        initMobileForms();
        initMobileTables();
        initOrientationHandler();
        initNetworkStatus();
        initLazyLoading();
        initBackButtonHandler();

        if (isIOS) {
            initIOSStandaloneFixes();
        }

        // Add mobile class to body
        if (isMobile) {
            document.body.classList.add('is-mobile');
        }
        if (hasTouch) {
            document.body.classList.add('has-touch');
        }
        if (isStandalone) {
            document.body.classList.add('is-standalone');
        }

        console.log('[Mobile] Initialization complete');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose utility functions
    window.MobileUtils = {
        isMobile,
        isIOS,
        isAndroid,
        hasTouch,
        isStandalone,
        showToast,
        vibrate,
        config
    };

})();
