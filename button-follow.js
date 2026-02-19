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
            // Hide button but keep it at the last cursor position
            button.style.opacity = '0';
        });

    });


    // Magnetic effect for buttons with class ctaa (except third__section__explore-btn)
    const magneticButtons = document.querySelectorAll('.ctaa:not(.third__section__explore-btn)');
    if (window.innerWidth > 768) {
        magneticButtons.forEach(button => {
            // Maximum distance button can move from original position (100px)
            const maxDistance = 50;

            let currentX = 0;
            let currentY = 0;
            let targetX = 0;
            let targetY = 0;
            let rafId = null;
            let isHovering = false;
            let originalCenterX = 0;
            let originalCenterY = 0;

            // Smooth interpolation function
            function lerp(start, end, factor) {
                return start + (end - start) * factor;
            }

            // Animation loop
            function animate() {
                // Smoothly interpolate current position toward target
                currentX = lerp(currentX, targetX, 0.15);
                currentY = lerp(currentY, targetY, 0.15);

                // Apply transform
                button.style.transform = `translate(${currentX}px, ${currentY}px)`;

                // Continue animation if hovering or if still moving
                if (isHovering || Math.abs(currentX - targetX) > 0.1 || Math.abs(currentY - targetY) > 0.1) {
                    rafId = requestAnimationFrame(animate);
                } else {
                    // Reset when animation is complete
                    currentX = 0;
                    currentY = 0;
                    targetX = 0;
                    targetY = 0;
                    button.style.transform = '';
                    button.style.willChange = 'auto';
                    rafId = null;
                }
            }

            button.addEventListener('mouseenter', (e) => {
                isHovering = true;

                // Store original button center position (before any transform)
                // Reset transform temporarily to get accurate position
                const tempTransform = button.style.transform;
                button.style.transform = '';
                const rect = button.getBoundingClientRect();
                originalCenterX = rect.left + rect.width / 2;
                originalCenterY = rect.top + rect.height / 2;
                button.style.transform = tempTransform;

                button.style.willChange = 'transform';
                button.style.transition = 'none'; // Disable CSS transitions for smooth animation

                // Start animation loop
                if (rafId === null) {
                    rafId = requestAnimationFrame(animate);
                }

                // Calculate initial target based on current mouse position
                const deltaX = e.clientX - originalCenterX;
                const deltaY = e.clientY - originalCenterY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (distance <= maxDistance) {
                    targetX = deltaX;
                    targetY = deltaY;
                } else {
                    const angle = Math.atan2(deltaY, deltaX);
                    targetX = Math.cos(angle) * maxDistance;
                    targetY = Math.sin(angle) * maxDistance;
                }
            });

            button.addEventListener('mousemove', (e) => {
                if (!isHovering) return;

                // Calculate vector from original position to cursor
                const deltaX = e.clientX - originalCenterX;
                const deltaY = e.clientY - originalCenterY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // If cursor is within 100px, button follows cursor
                if (distance <= maxDistance) {
                    // Button follows cursor directly
                    targetX = deltaX;
                    targetY = deltaY;
                } else {
                    // If cursor is beyond 100px, button stays at 100px limit
                    // Calculate position at max distance in the direction of cursor
                    const angle = Math.atan2(deltaY, deltaX);
                    targetX = Math.cos(angle) * maxDistance;
                    targetY = Math.sin(angle) * maxDistance;
                }
            });

            button.addEventListener('mouseleave', () => {
                isHovering = false;
                originalRect = null;
                targetX = 0;
                targetY = 0;

                // Let animation loop handle the return to center
                // It will stop automatically when movement is complete
            });
        });
    }

    // Form container toggle functionality
    const formContainer = document.getElementById('form_container');

    if (formContainer) {
        // Add active class when clicking on .ctaa or .footer__link
        const ctaaButtons = document.querySelectorAll('.ctaa, .third__section__image');
        const footerLinks = document.querySelectorAll('.footer__link');

        // Function to add active class
        function openForm(e) {
            e.preventDefault();
            e.stopPropagation();
            formContainer.classList.add('active');
            // Stop Lenis smooth scrolling when form is active
            if (typeof lenis !== 'undefined' && lenis) {
                lenis.stop();
            }
        }

        // Function to remove active class
        function closeForm(e) {
            e.preventDefault();
            e.stopPropagation();
            formContainer.classList.remove('active');
            // Resume Lenis smooth scrolling when form is closed
            if (typeof lenis !== 'undefined' && lenis) {
                lenis.start();
            }
        }

        // Add click listeners to all .ctaa buttons
        ctaaButtons.forEach(button => {
            button.addEventListener('click', openForm);
        });

        // Add click listeners to all .footer__link elements
        footerLinks.forEach(link => {
            link.addEventListener('click', openForm);
        });

        // Remove active class when clicking on .close_icon
        const closeIcon = formContainer.querySelector('.close_icon');
        if (closeIcon) {
            closeIcon.addEventListener('click', closeForm);
        }

        // Remove active class when clicking on #form_container (but not on its children)
        formContainer.addEventListener('click', function (e) {
            // Only close if clicking directly on the container, not on child elements
            if (e.target === formContainer) {
                closeForm(e);
            }
        });
    }

});


document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('.hero__bgtext-wrapper').style.opacity = '1';
    gsap.to('.hero__bgtext-wrapper', {
        y: '-50%',
        duration: 1,
        ease: 'power2.inOut',
    });
    gsap.to('.hero__footer-wrapper', {
        y: '0%',
        opacity: 1,
        duration: 1,
        ease: 'power2.inOut',
    });
    // Animate elements sequentially (one after another)
    const animatedElements = document.querySelectorAll('[animate-on-scroll]');
    animatedElements.forEach((element, index) => {
        gsap.to(element, {
            transform: 'translateY(0%)',
            opacity: 1,
            duration: 1,
            ease: 'power2.inOut',
            delay: index * 0.2, // Stagger delay - each element starts 0.2s after the previous one
            scrollTrigger: {
                trigger: '.section__second__content-wrapper',
                start: 'top 80%',
                end: 'bottom top',
                scrub: false,
                toggleActions: "play none none reverse"
            },
        });
    });


    const animatedElementsthird = document.querySelectorAll('[animate-on-scroll-third]');
    animatedElementsthird.forEach((element, index) => {
        gsap.to(element, {
            transform: 'translateY(0%)',
            opacity: 1,
            duration: 0.5,
            ease: 'power2.inOut',
            delay: index * 0.2, // Stagger delay - each element starts 0.2s after the previous one
            scrollTrigger: {
                trigger: '.fourth__section__heading',
                start: 'top 80%',
                end: 'bottom top',
                scrub: false,
                toggleActions: "play none none reverse"
            },
        });
    });

    const animatedElementforth = document.querySelectorAll('[animate-on-scroll-four]');
    animatedElementforth.forEach((element, index) => {
        gsap.to(element, {

            transform: 'translateY(0%)',
            opacity: 1,
            duration: 0.5,
            ease: 'power2.inOut',
            delay: index * 0.2, // Stagger delay - each element starts 0.2s after the previous one
            scrollTrigger: {
                trigger: '.fifth__section__heading',
                start: 'top 90%',
                end: 'bottom top',
                scrub: false,
                toggleActions: "play none none reverse"
            },
        });
    });
    setTimeout(() => {
        gsap.to('.fifth__section__watermark', {
            y: '0%',
            duration: 0.5,
            ease: 'power2.inOut',
            scrollTrigger: {
                trigger: '.fifth__section__watermark',
                start: '-100% 100%',
                end: 'bottom top',
                scrub: false,
                toggleActions: "play none none reverse",
            },
        });
    }, 1000);
});