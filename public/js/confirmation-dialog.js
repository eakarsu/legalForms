/**
 * Custom Confirmation Dialog
 * Replaces native confirm() with Bootstrap 5 modal
 */

function showConfirmDialog({ title, message, confirmText, confirmClass, onConfirm }) {
    const modal = document.getElementById('confirmationModal');
    if (!modal) {
        // Fallback to native confirm if modal not in DOM
        if (confirm(message)) {
            onConfirm();
        }
        return;
    }

    const modalHeader = document.getElementById('confirmModalHeader');
    const modalLabel = document.getElementById('confirmationModalLabel');
    const modalBody = document.getElementById('confirmModalBody');
    const confirmBtn = document.getElementById('confirmModalBtn');

    // Set content
    modalLabel.textContent = title || 'Confirm Action';
    modalBody.textContent = message || 'Are you sure you want to proceed?';
    confirmBtn.textContent = confirmText || 'Confirm';

    // Set styling
    confirmBtn.className = 'btn ' + (confirmClass || 'btn-danger');

    // Danger styling for header on destructive actions
    if (confirmClass === 'btn-danger' || !confirmClass) {
        modalHeader.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        modalHeader.style.color = '#fff';
        modal.querySelector('.btn-close').style.filter = 'invert(1)';
    } else {
        modalHeader.style.background = '';
        modalHeader.style.color = '';
        modal.querySelector('.btn-close').style.filter = '';
    }

    // Remove previous event listener
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    // Add new event listener
    newBtn.addEventListener('click', function () {
        var bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
        onConfirm();
    });

    // Show modal
    var bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}
