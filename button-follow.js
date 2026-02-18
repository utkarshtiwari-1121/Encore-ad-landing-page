document.addEventListener('DOMContentLoaded', function () {

    const wrappers = document.querySelectorAll('.third__section__image-wrapper');

    wrappers.forEach(wrapper => {
        const button = wrapper.querySelector('.third__section__explore-btn');
        if (!button) return;

        // Cache button dimensions (only measure once)
        let btnWidth = button.offsetWidth;
        let btnHeight = button.offsetHeight;
        
        // Update dimensions on resize
        const updateDimensions = () => {
            btnWidth = button.offsetWidth;
            btnHeight = button.offsetHeight;
        };
        window.addEventListener('resize', updateDimensions);

        button.style.opacity = '0';
        button.style.transition = 'opacity 0.3s ease-out';
        button.style.willChange = 'transform';
        
        // Use requestAnimationFrame to throttle updates
        let rafId = null;
        let targetX = 0;
        let targetY = 0;

        wrapper.addEventListener('mouseenter', () => {
            button.style.opacity = '1';
            // Update dimensions in case they changed
            updateDimensions();
        });

        wrapper.addEventListener('mousemove', (e) => {
            // Calculate target position
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Center button on cursor
            targetX = x - btnWidth / 2;
            targetY = y - btnHeight / 2;

            // Throttle DOM updates with requestAnimationFrame
            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    // Use transform for better performance (GPU accelerated)
                    button.style.transform = `translate(${targetX}px, ${targetY}px)`;
                    button.style.left = '0';
                    button.style.top = '0';
                    button.style.right = 'auto';
                    button.style.bottom = 'auto';
                    rafId = null;
                });
            }
        });

        wrapper.addEventListener('mouseleave', () => {
            // Cancel pending animation frame
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            button.style.opacity = '0';
        });

    });

});