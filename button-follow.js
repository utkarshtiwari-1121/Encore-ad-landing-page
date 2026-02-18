// Button cursor follow effect
// Makes the explore button follow the cursor when hovering over the image

function initButtonCursorFollow() {
    // Find all image wrappers
    const imageWrappers = document.querySelectorAll('.third__section__image-wrapper');
    
    imageWrappers.forEach(wrapper => {
        const image = wrapper.querySelector('.third__section__image');
        const button = wrapper.querySelector('.third__section__explore-btn');
        
        if (!image || !button) return;
        
        // Add smooth transition for button movement and opacity
        button.style.transition = 'left 0.15s ease-out, top 0.15s ease-out, opacity 0.3s ease-out';
        
        // Initially hide the button
        button.style.opacity = '0';
        button.style.pointerEvents = 'none';
        
        // Offset from cursor (so button doesn't stick directly to cursor)
        const offsetX = 0;
        const offsetY = 0;
        
        let isHovering = false;
        
        function updateButtonPosition(e) {
            if (!isHovering) return;
            
            const wrapperRect = wrapper.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            
            // Get mouse position relative to wrapper
            const mouseX = e.clientX - wrapperRect.left;
            const mouseY = e.clientY - wrapperRect.top;
            
            // Calculate button position with offset
            let posX = mouseX + offsetX;
            let posY = mouseY + offsetY;
            
            // Keep button within wrapper bounds
            // If button would go outside on right, position it to the left of cursor
            if (posX + buttonRect.width > wrapperRect.width) {
                posX = mouseX - buttonRect.width - offsetX;
            }
            // If button would go outside on bottom, position it above cursor
            if (posY + buttonRect.height > wrapperRect.height) {
                posY = mouseY - buttonRect.height - offsetY;
            }
            
            // Ensure button stays within wrapper
            posX = Math.max(0, Math.min(posX, wrapperRect.width - buttonRect.width));
            posY = Math.max(0, Math.min(posY, wrapperRect.height - buttonRect.height));
            
            // Update button position
            button.style.left = posX + 'px';
            button.style.top = posY + 'px';
            button.style.right = 'auto';
            button.style.bottom = 'auto';
        }
        
        function resetButtonPosition() {
            isHovering = false;
            // Hide button when mouse leaves, but keep it at the last cursor position
            button.style.opacity = '0';
            button.style.pointerEvents = 'none';
            // Don't reset position - keep it at the last cursor position
        }
        
        function onMouseEnter() {
            isHovering = true;
            // Show button when mouse enters
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        }
        
        // Add event listeners
        wrapper.addEventListener('mouseenter', onMouseEnter);
        wrapper.addEventListener('mousemove', updateButtonPosition);
        wrapper.addEventListener('mouseleave', resetButtonPosition);
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initButtonCursorFollow();
});
