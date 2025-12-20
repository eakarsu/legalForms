/**
 * Voice Input Module
 * Uses browser Web Speech API for real-time speech-to-text
 * No API costs - completely free and open source
 */

class VoiceInput {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.supported = this.initializeRecognition();
    }

    /**
     * Initialize the Web Speech API
     * @returns {boolean} Whether speech recognition is supported
     */
    initializeRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            return false;
        }

        // Create recognition instance
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Configuration for optimal performance
        this.recognition.continuous = true;  // Keep listening until stopped
        this.recognition.interimResults = true;  // Show real-time results as user speaks
        this.recognition.lang = 'en-US';  // Default language
        this.recognition.maxAlternatives = 1;  // Only need the best match

        // Bind event handlers
        this.recognition.onstart = () => this.handleStart();
        this.recognition.onresult = (event) => this.handleResult(event);
        this.recognition.onerror = (event) => this.handleError(event);
        this.recognition.onend = () => this.handleEnd();

        return true;
    }

    /**
     * Called when speech recognition starts
     */
    handleStart() {
        console.log('Voice input started');
        this.isListening = true;

        // Update UI to show recording state
        $('#voiceInputBtn')
            .addClass('btn-danger')
            .removeClass('btn-outline-danger');
        $('#voiceBtnText').text('Stop');
        $('#voiceIcon').removeClass('fa-microphone').addClass('fa-stop-circle');

        // Show status indicator
        $('#voiceStatus').slideDown(200);
        $('#voiceStatusText').text('Listening... Speak now');
        $('#voiceStatus .alert')
            .removeClass('alert-danger alert-success')
            .addClass('alert-info');
    }

    /**
     * Process speech recognition results in real-time
     * @param {SpeechRecognitionEvent} event
     */
    handleResult(event) {
        let interim = '';

        // Process all results from the event
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                // Final result - add to permanent transcript
                this.finalTranscript += transcript + ' ';
            } else {
                // Interim result - show but don't save yet
                interim += transcript;
            }
        }

        // Update the textarea with live transcription
        const combinedText = this.finalTranscript + interim;
        $('#naturalLanguageInput').val(combinedText);

        // Update status with interim results
        if (interim) {
            const preview = interim.length > 50 ? interim.substring(0, 50) + '...' : interim;
            $('#voiceStatusText').html(`<strong>Hearing:</strong> "${preview}"`);
        } else {
            $('#voiceStatusText').text('Listening... Keep speaking');
        }

        // Auto-scroll textarea to show latest content
        const textarea = document.getElementById('naturalLanguageInput');
        if (textarea) {
            textarea.scrollTop = textarea.scrollHeight;
        }
    }

    /**
     * Handle speech recognition errors
     * @param {SpeechRecognitionErrorEvent} event
     */
    handleError(event) {
        console.error('Speech recognition error:', event.error);

        let errorMessage = 'Error occurred';
        let canRetry = true;

        switch(event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Try speaking again.';
                break;
            case 'audio-capture':
                errorMessage = 'No microphone found. Please check your device.';
                canRetry = false;
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied. Please allow access in browser settings.';
                canRetry = false;
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                break;
            case 'aborted':
                // User stopped it, not an error
                return;
            default:
                errorMessage = `Speech recognition error: ${event.error}`;
        }

        // Show error in UI
        $('#voiceStatusText').html(`<i class="fas fa-exclamation-triangle"></i> ${errorMessage}`);
        $('#voiceStatus .alert')
            .removeClass('alert-info')
            .addClass('alert-danger');

        // Auto-hide error after delay
        setTimeout(() => {
            this.stop();
            if (!canRetry) {
                $('#voiceInputBtn').prop('disabled', true);
            }
        }, 3000);
    }

    /**
     * Called when speech recognition ends
     */
    handleEnd() {
        console.log('Voice input ended');
        this.isListening = false;

        // Reset UI to initial state
        $('#voiceInputBtn')
            .removeClass('btn-danger')
            .addClass('btn-outline-danger');
        $('#voiceBtnText').text('Voice');
        $('#voiceIcon').removeClass('fa-stop-circle').addClass('fa-microphone');

        // Check if we have transcribed content
        const hasContent = this.finalTranscript.trim().length > 0;

        if (hasContent) {
            // Show success message
            $('#voiceStatusText').html('<i class="fas fa-check-circle"></i> Voice input complete! Processing with AI...');
            $('#voiceStatus .alert')
                .removeClass('alert-info')
                .addClass('alert-success');

            // Auto-trigger AI parse after a short delay
            setTimeout(() => {
                $('#parseNLBtn').click();
                $('#voiceStatus').slideUp(300);
            }, 1000);
        } else {
            // No content captured, just hide
            $('#voiceStatus').slideUp(300);
        }
    }

    /**
     * Start voice input
     */
    start() {
        if (!this.supported) {
            this.showBrowserNotSupported();
            return;
        }

        if (this.isListening) {
            this.stop();
            return;
        }

        // Keep existing text in textarea
        const existingText = $('#naturalLanguageInput').val() || '';
        this.finalTranscript = existingText ? existingText + ' ' : '';
        this.interimTranscript = '';

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);

            // Handle case where recognition is already running
            if (error.message && error.message.includes('already started')) {
                this.stop();
                setTimeout(() => this.start(), 100);
            } else {
                alert('Failed to start voice input. Please try again.');
            }
        }
    }

    /**
     * Stop voice input
     */
    stop() {
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
                // Force reset UI even if stop fails
                this.isListening = false;
                this.handleEnd();
            }
        }
    }

    /**
     * Toggle voice input on/off
     */
    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Change the language for speech recognition
     * @param {string} langCode - Language code (e.g., 'en-US', 'es-ES', 'fr-FR')
     */
    setLanguage(langCode) {
        if (this.recognition) {
            this.recognition.lang = langCode;
            console.log('Voice input language set to:', langCode);
        }
    }

    /**
     * Show error message when browser doesn't support speech recognition
     */
    showBrowserNotSupported() {
        const message = `
            <div class="alert alert-warning" role="alert">
                <h6><i class="fas fa-exclamation-triangle"></i> Voice Input Not Supported</h6>
                <p class="mb-2">Your browser doesn't support voice input. Please use one of these browsers:</p>
                <ul class="mb-0">
                    <li>Google Chrome (recommended)</li>
                    <li>Microsoft Edge</li>
                    <li>Safari 14.1+</li>
                </ul>
            </div>
        `;

        // Create modal or show inline message
        $('#voiceStatus').html(message).slideDown();
        setTimeout(() => {
            $('#voiceStatus').slideUp(300);
        }, 5000);
    }

    /**
     * Check if voice input is currently active
     * @returns {boolean}
     */
    isActive() {
        return this.isListening;
    }

    /**
     * Get the current transcript
     * @returns {string}
     */
    getTranscript() {
        return this.finalTranscript + this.interimTranscript;
    }

    /**
     * Clear the transcript
     */
    clearTranscript() {
        this.finalTranscript = '';
        this.interimTranscript = '';
    }
}

// Global instance
let voiceInput;

// Initialize when page loads
$(document).ready(function() {
    console.log('Initializing voice input...');

    // Create voice input instance
    voiceInput = new VoiceInput();

    // Disable button if not supported
    if (!voiceInput.supported) {
        $('#voiceInputBtn')
            .prop('disabled', true)
            .attr('title', 'Voice input not supported in this browser');
        $('#voiceBtnText').text('Not Supported');
    }

    // Bind voice button click
    $('#voiceInputBtn').on('click', function(e) {
        e.preventDefault();
        voiceInput.toggle();
    });

    // Stop listening when user manually focuses on textarea
    $('#naturalLanguageInput').on('focus', function() {
        if (voiceInput && voiceInput.isListening) {
            console.log('User focused on textarea, stopping voice input');
            voiceInput.stop();
        }
    });

    // Keyboard shortcut: Ctrl/Cmd + Shift + V to toggle voice input
    $(document).on('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
            e.preventDefault();
            if (voiceInput && voiceInput.supported) {
                voiceInput.toggle();
            }
        }
    });

    // Stop voice input when page is unloaded
    $(window).on('beforeunload', function() {
        if (voiceInput && voiceInput.isListening) {
            voiceInput.stop();
        }
    });

    console.log('Voice input initialized successfully');
});

// Export for use in other scripts
window.voiceInput = voiceInput;
